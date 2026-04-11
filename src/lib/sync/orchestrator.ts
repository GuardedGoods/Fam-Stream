import { db } from "@/lib/db";
import {
  movies,
  contentRatings,
  contentRatingsAggregated,
  movieProviders,
  streamingProviders,
} from "@/lib/db/schema";
import { eq, isNull, sql } from "drizzle-orm";
import {
  discoverMovies,
  getMovieDetails,
  getMovieCertifications,
  getWatchProviders,
  generateSlug,
} from "@/lib/apis/tmdb";
import { getMovieByImdbId } from "@/lib/apis/omdb";
import { scrapeKidsInMind } from "@/lib/scrapers/kids-in-mind";
import { scrapeImdbParentalGuide } from "@/lib/scrapers/imdb-parental";
import { scrapeCommonSenseMedia } from "@/lib/scrapers/common-sense-media";
import { extractProfanityWords } from "@/lib/scrapers/word-extractor";
import {
  normalizeKidsInMindScore,
  normalizeImdbSeverity,
  aggregateScores,
} from "@/lib/scrapers/normalize";

let isSyncing = false;

export async function runSync(type: string) {
  if (isSyncing) {
    console.log("Sync already in progress, skipping");
    return;
  }

  isSyncing = true;
  console.log(`Starting ${type} sync...`);

  try {
    switch (type) {
      case "movies":
        await syncMovies();
        break;
      case "content":
        await syncContentRatings();
        break;
      case "streaming":
        await syncStreamingAvailability();
        break;
      case "full":
        await syncMovies();
        await syncContentRatings();
        await syncStreamingAvailability();
        break;
      default:
        console.log(`Unknown sync type: ${type}`);
    }
  } catch (error) {
    console.error(`Sync ${type} failed:`, error);
  } finally {
    isSyncing = false;
    console.log(`${type} sync completed`);
  }
}

async function syncMovies() {
  console.log("Syncing movies from TMDB...");

  // Phase 1: Quick insert - get basic movie data from discover endpoint
  // This is fast (1 API call per 20 movies) so movies appear quickly
  const pagesToFetch = 50; // 1000 movies
  let totalInserted = 0;

  for (let page = 1; page <= pagesToFetch; page++) {
    try {
      const result = await discoverMovies(page);
      if (!result?.results) continue;

      for (const tmdbMovie of result.results) {
        try {
          const existing = db
            .select({ id: movies.id })
            .from(movies)
            .where(eq(movies.tmdbId, tmdbMovie.id))
            .get();

          if (existing) continue;

          const year = tmdbMovie.release_date?.substring(0, 4) || "";
          const slug = generateSlug(tmdbMovie.title, year);

          // Insert with basic data from discover (no extra API calls)
          db.insert(movies)
            .values({
              tmdbId: tmdbMovie.id,
              title: tmdbMovie.title,
              slug,
              overview: tmdbMovie.overview || null,
              releaseDate: tmdbMovie.release_date || null,
              posterPath: tmdbMovie.poster_path || null,
              backdropPath: tmdbMovie.backdrop_path || null,
              popularity: tmdbMovie.popularity || null,
              genres: JSON.stringify([]),
              lastSyncedAt: new Date().toISOString(),
            })
            .run();

          totalInserted++;
        } catch (e) {
          console.error(`Error inserting movie ${tmdbMovie.title}:`, e);
        }
      }

      console.log(`Phase 1: page ${page}/${pagesToFetch}, inserted: ${totalInserted}`);
    } catch (e) {
      console.error(`Error fetching page ${page}:`, e);
    }
  }

  console.log(`Phase 1 complete. ${totalInserted} movies added.`);

  if (totalInserted === 0) {
    console.error("Phase 1 inserted 0 movies. Check TMDB API key and database connectivity.");
    return;
  }

  console.log("Starting Phase 2 enrichment...");

  // Phase 2: Enrich movies with details, ratings, and providers
  // This runs in background - movies are already visible
  const moviesToEnrich = db
    .select({ id: movies.id, tmdbId: movies.tmdbId, title: movies.title })
    .from(movies)
    .where(isNull(movies.imdbId))
    .limit(200)
    .all();

  let enriched = 0;
  for (const movie of moviesToEnrich) {
    try {
      // Get full details (runtime, genres, imdb_id)
      const details = await getMovieDetails(movie.tmdbId);
      if (!details) continue;

      // Get MPAA rating
      const certifications = await getMovieCertifications(movie.tmdbId);

      const genreNames = details.genres?.map(
        (g: { name: string }) => g.name
      ) || [];

      db.update(movies)
        .set({
          imdbId: details.imdb_id || null,
          runtimeMinutes: details.runtime || null,
          mpaaRating: certifications || null,
          genres: JSON.stringify(genreNames),
        })
        .where(eq(movies.id, movie.id))
        .run();

      // Get OMDb data (Rotten Tomatoes scores)
      if (details.imdb_id) {
        try {
          const omdbData = await getMovieByImdbId(details.imdb_id);
          if (omdbData) {
            db.update(movies)
              .set({
                imdbRating: omdbData.imdbRating ?? null,
                rottenTomatoesScore: omdbData.rottenTomatoesScore,
                metacriticScore: omdbData.metacriticScore,
              })
              .where(eq(movies.id, movie.id))
              .run();
          }
        } catch (e) {
          console.error(`OMDb error for ${movie.title}:`, e);
        }
      }

      // Get watch providers
      try {
        await syncMovieProviders(movie.tmdbId);
      } catch (e) {
        console.error(`Watch providers error for ${movie.title}:`, e);
      }

      enriched++;
      if (enriched % 20 === 0) {
        console.log(`Phase 2: enriched ${enriched}/${moviesToEnrich.length}`);
      }
    } catch (e) {
      console.error(`Error enriching movie ${movie.title}:`, e);
    }
  }

  console.log(`Movie sync complete. ${totalInserted} inserted, ${enriched} enriched.`);
}

async function syncMovieProviders(tmdbId: number) {
  const providers = await getWatchProviders(tmdbId);
  if (!providers) return;

  const movie = db
    .select({ id: movies.id })
    .from(movies)
    .where(eq(movies.tmdbId, tmdbId))
    .get();

  if (!movie) return;

  // Process flatrate (subscription), rent, and buy
  const types = ["flatrate", "rent", "buy"] as const;

  for (const type of types) {
    const providerList = providers[type];
    if (!providerList) continue;

    for (const provider of providerList) {
      // Ensure provider exists in our table
      const existingProvider = db
        .select()
        .from(streamingProviders)
        .where(eq(streamingProviders.tmdbProviderId, provider.provider_id))
        .get();

      let providerId: number;
      if (!existingProvider) {
        const result = db
          .insert(streamingProviders)
          .values({
            tmdbProviderId: provider.provider_id,
            name: provider.provider_name,
            logoPath: provider.logo_path || null,
            displayPriority: provider.display_priority || 999,
          })
          .run();
        providerId = Number(result.lastInsertRowid);
      } else {
        providerId = existingProvider.id;
      }

      // Upsert movie-provider link
      const existingLink = db
        .select()
        .from(movieProviders)
        .where(
          sql`${movieProviders.movieId} = ${movie.id} AND ${movieProviders.providerId} = ${providerId} AND ${movieProviders.type} = ${type}`
        )
        .get();

      if (!existingLink) {
        db.insert(movieProviders)
          .values({
            movieId: movie.id,
            providerId,
            type,
            link: providers.link || null,
            country: "US",
            lastCheckedAt: new Date().toISOString(),
          })
          .run();
      } else {
        db.update(movieProviders)
          .set({ lastCheckedAt: new Date().toISOString() })
          .where(eq(movieProviders.id, existingLink.id))
          .run();
      }
    }
  }
}

async function syncContentRatings() {
  console.log("Scraping content ratings...");

  // Get movies that don't have content ratings yet
  const moviesWithoutRatings = db
    .select({
      id: movies.id,
      title: movies.title,
      imdbId: movies.imdbId,
      releaseDate: movies.releaseDate,
    })
    .from(movies)
    .leftJoin(
      contentRatingsAggregated,
      eq(movies.id, contentRatingsAggregated.movieId)
    )
    .where(isNull(contentRatingsAggregated.id))
    .limit(50) // Process 50 at a time
    .all();

  console.log(
    `Found ${moviesWithoutRatings.length} movies without content ratings`
  );

  for (const movie of moviesWithoutRatings) {
    try {
      await scrapeContentForMovie(movie);
    } catch (e) {
      console.error(`Error scraping content for ${movie.title}:`, e);
    }
  }
}

export async function scrapeContentForMovie(movie: {
  id: number;
  title: string;
  imdbId: string | null;
  releaseDate: string | null;
}) {
  const year = movie.releaseDate?.substring(0, 4);
  const sources: Array<{
    source: string;
    languageScore: number;
    violenceScore: number;
    sexualScore: number;
    scaryScore?: number;
  }> = [];

  // 1. Kids-In-Mind
  try {
    const kimData = await scrapeKidsInMind(movie.title, year);
    if (kimData) {
      const profanityWords = extractProfanityWords(
        kimData.languageNotes || ""
      );

      db.insert(contentRatings)
        .values({
          movieId: movie.id,
          source: "kids-in-mind",
          languageScore: kimData.languageScore,
          violenceScore: kimData.violenceScore,
          sexualContentScore: kimData.sexualScore,
          scaryScore: null,
          languageNotes: kimData.languageNotes || null,
          violenceNotes: kimData.violenceNotes || null,
          sexualNotes: kimData.sexualNotes || null,
          scaryNotes: null,
          profanityWords: JSON.stringify(profanityWords),
          sourceUrl: kimData.sourceUrl || null,
          scrapedAt: new Date().toISOString(),
        })
        .onConflictDoNothing()
        .run();

      sources.push({
        source: "kids-in-mind",
        languageScore: normalizeKidsInMindScore(kimData.languageScore),
        violenceScore: normalizeKidsInMindScore(kimData.violenceScore),
        sexualScore: normalizeKidsInMindScore(kimData.sexualScore),
      });
    }
  } catch (e) {
    console.error(`Kids-In-Mind scrape failed for ${movie.title}:`, e);
  }

  // 2. IMDb Parental Guide
  if (movie.imdbId) {
    try {
      const imdbData = await scrapeImdbParentalGuide(movie.imdbId);
      if (imdbData) {
        const allNotes = [
          imdbData.profanity.notes,
          imdbData.violenceAndGore.notes,
          imdbData.sexAndNudity.notes,
        ]
          .filter(Boolean)
          .join(" ");
        const profanityWords = extractProfanityWords(allNotes);

        db.insert(contentRatings)
          .values({
            movieId: movie.id,
            source: "imdb",
            languageScore: imdbData.profanity.score,
            violenceScore: imdbData.violenceAndGore.score,
            sexualContentScore: imdbData.sexAndNudity.score,
            scaryScore: imdbData.frighteningIntenseScenes.score,
            languageNotes: imdbData.profanity.notes || null,
            violenceNotes: imdbData.violenceAndGore.notes || null,
            sexualNotes: imdbData.sexAndNudity.notes || null,
            scaryNotes: imdbData.frighteningIntenseScenes.notes || null,
            profanityWords: JSON.stringify(profanityWords),
            sourceUrl: imdbData.sourceUrl,
            scrapedAt: new Date().toISOString(),
          })
          .onConflictDoNothing()
          .run();

        sources.push({
          source: "imdb",
          languageScore: normalizeImdbSeverity(
            imdbData.profanity.severity || "None"
          ),
          violenceScore: normalizeImdbSeverity(
            imdbData.violenceAndGore.severity || "None"
          ),
          sexualScore: normalizeImdbSeverity(
            imdbData.sexAndNudity.severity || "None"
          ),
          scaryScore: normalizeImdbSeverity(
            imdbData.frighteningIntenseScenes.severity || "None"
          ),
        });
      }
    } catch (e) {
      console.error(`IMDb scrape failed for ${movie.title}:`, e);
    }
  }

  // 3. Common Sense Media
  try {
    const csmData = await scrapeCommonSenseMedia(movie.title, year);
    if (csmData) {
      db.insert(contentRatings)
        .values({
          movieId: movie.id,
          source: "common-sense-media",
          languageScore: csmData.language.score,
          violenceScore: csmData.violence.score,
          sexualContentScore: csmData.sex.score,
          scaryScore: null,
          languageNotes: csmData.language.notes || null,
          violenceNotes: csmData.violence.notes || null,
          sexualNotes: csmData.sex.notes || null,
          scaryNotes: null,
          recommendedAge: csmData.recommendedAge || null,
          profanityWords: null,
          sourceUrl: csmData.sourceUrl || null,
          scrapedAt: new Date().toISOString(),
        })
        .onConflictDoNothing()
        .run();

      sources.push({
        source: "common-sense-media",
        languageScore: csmData.language.score,
        violenceScore: csmData.violence.score,
        sexualScore: csmData.sex.score,
      });
    }
  } catch (e) {
    console.error(`Common Sense Media scrape failed for ${movie.title}:`, e);
  }

  // Aggregate scores and update
  if (sources.length > 0) {
    const aggregated = aggregateScores(sources);

    // Collect all profanity words from all sources
    const allSourceRatings = db
      .select()
      .from(contentRatings)
      .where(eq(contentRatings.movieId, movie.id))
      .all();

    const allWords: Record<string, number> = {};
    for (const sr of allSourceRatings) {
      if (sr.profanityWords) {
        const words = JSON.parse(sr.profanityWords);
        for (const [word, count] of Object.entries(words)) {
          allWords[word] = Math.max(allWords[word] || 0, count as number);
        }
      }
    }

    // Combine notes from all sources
    const allLanguageNotes = allSourceRatings
      .map((r) => r.languageNotes)
      .filter(Boolean)
      .join(" | ");
    const allViolenceNotes = allSourceRatings
      .map((r) => r.violenceNotes)
      .filter(Boolean)
      .join(" | ");
    const allSexualNotes = allSourceRatings
      .map((r) => r.sexualNotes)
      .filter(Boolean)
      .join(" | ");
    const allScaryNotes = allSourceRatings
      .map((r) => r.scaryNotes)
      .filter(Boolean)
      .join(" | ");

    // Upsert aggregated rating
    const existing = db
      .select()
      .from(contentRatingsAggregated)
      .where(eq(contentRatingsAggregated.movieId, movie.id))
      .get();

    const aggregatedData = {
      movieId: movie.id,
      languageScore: aggregated.language,
      violenceScore: aggregated.violence,
      sexualContentScore: aggregated.sexual,
      scaryScore: aggregated.scary,
      languageNotes: allLanguageNotes || null,
      violenceNotes: allViolenceNotes || null,
      sexualNotes: allSexualNotes || null,
      scaryNotes: allScaryNotes || null,
      specificWords: JSON.stringify(Object.keys(allWords)),
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      db.update(contentRatingsAggregated)
        .set(aggregatedData)
        .where(eq(contentRatingsAggregated.id, existing.id))
        .run();
    } else {
      db.insert(contentRatingsAggregated).values(aggregatedData).run();
    }
  }
}

async function syncStreamingAvailability() {
  console.log("Refreshing streaming availability...");

  const allMovies = db
    .select({ id: movies.id, tmdbId: movies.tmdbId })
    .from(movies)
    .all();

  let updated = 0;
  for (const movie of allMovies) {
    try {
      await syncMovieProviders(movie.tmdbId);
      updated++;

      if (updated % 100 === 0) {
        console.log(`Updated streaming for ${updated}/${allMovies.length} movies`);
      }
    } catch (e) {
      console.error(`Streaming sync error for tmdb ${movie.tmdbId}:`, e);
    }
  }

  console.log(`Streaming availability sync complete. Updated ${updated} movies.`);
}
