import { db } from "@/lib/db";
import {
  movies,
  contentRatings,
  contentRatingsAggregated,
  movieProviders,
  streamingProviders,
  movieCast,
} from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  discoverMovies,
  getMovieDetails,
  getMovieCertifications,
  getMovieCredits,
  getWatchProviders,
  generateSlug,
} from "@/lib/apis/tmdb";
import {
  getMovieByImdbId,
  OmdbRateLimitError,
  type OmdbFailureKind,
} from "@/lib/apis/omdb";
import { mapCreditsToRows } from "./credits-mapper";

// ---------------------------------------------------------------------------
// OMDb circuit breaker
//
// OMDb's free tier caps at 1,000 calls/day and responds to over-limit
// requests with HTTP 200 + {Response:"False", Error:"Request limit
// reached!"}. The client now throws a typed OmdbRateLimitError on that
// (and on invalid/missing key). The orchestrator tracks the most recent
// such failure in module-scope state so that:
//
//   (a) after the first rate-limit/auth trip, subsequent movies in the
//       same run skip the OMDb call entirely — preserves whatever wall
//       clock + remaining quota we have;
//   (b) the /api/admin/status endpoint can surface the failure in the
//       dashboard so the operator knows why RT% is 0.
//
// State is intentionally process-memory. Quota resets at UTC midnight
// and key-config fixes require a restart anyway, so persistence would
// just complicate things.
// ---------------------------------------------------------------------------

interface OmdbFailure {
  kind: OmdbFailureKind;
  at: string; // ISO
  message: string;
}

let omdbDisabledForRun = false;
let lastOmdbFailure: OmdbFailure | null = null;

export function getLastOmdbFailure(): OmdbFailure | null {
  return lastOmdbFailure;
}

/** Exposed for tests so they can reset the circuit-breaker between runs. */
export function __resetOmdbCircuitBreakerForTests() {
  omdbDisabledForRun = false;
  lastOmdbFailure = null;
}
import { scrapeKidsInMind } from "@/lib/scrapers/kids-in-mind";
import { scrapeImdbParentalGuide } from "@/lib/scrapers/imdb-parental";
import { scrapeCommonSenseMedia } from "@/lib/scrapers/common-sense-media";
import { extractProfanityWords } from "@/lib/scrapers/word-extractor";
import {
  normalizeKidsInMindScore,
  normalizeImdbSeverity,
  aggregateScores,
} from "@/lib/scrapers/normalize";

// TMDB genre ID → name mapping (from /genre/movie/list)
const TMDB_GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

function genreIdsToNames(ids: number[]): string[] {
  return ids.map((id) => TMDB_GENRE_MAP[id]).filter(Boolean);
}

let isSyncing = false;

export async function runSync(type: string) {
  if (isSyncing) {
    console.log("Sync already in progress, skipping");
    return;
  }

  isSyncing = true;
  // Reset the OMDb circuit breaker at the start of each run. Quota resets
  // daily at UTC midnight so a fresh scheduled run should re-probe OMDb
  // even if the last one tripped the breaker.
  omdbDisabledForRun = false;
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

  // TMDB watch provider IDs for the family's streaming services
  const STREAMING_PROVIDERS = [
    { id: 8, name: "Netflix" },
    { id: 9, name: "Amazon Prime Video" },
    { id: 337, name: "Disney Plus" },
    { id: 350, name: "Apple TV Plus" },
    { id: 384, name: "HBO Max" },
    { id: 386, name: "Peacock" },
    { id: 531, name: "Paramount Plus" },
  ];

  let totalInserted = 0;

  // Phase 1: Fetch movies from each streaming service
  // TMDB discover with watch_providers filter gets movies available on each service
  for (const provider of STREAMING_PROVIDERS) {
    const pagesPerProvider = 500; // up to 10,000 movies per service (TMDB max)
    console.log(`Fetching movies from ${provider.name}...`);

    for (let page = 1; page <= pagesPerProvider; page++) {
      try {
        const result = await discoverMovies(page, {
          watchProviders: [provider.id],
          watchRegion: "US",
        });
        if (!result?.results || result.results.length === 0) break;

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

            const genreNames = genreIdsToNames(tmdbMovie.genre_ids || []);

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
                genres: JSON.stringify(genreNames),
                lastSyncedAt: new Date().toISOString(),
              })
              .run();

            totalInserted++;
          } catch (e) {
            console.error(`Error inserting movie ${tmdbMovie.title}:`, e);
          }
        }
      } catch (e) {
        console.error(`Error fetching ${provider.name} page ${page}:`, e);
      }
    }

    console.log(`${provider.name} done. Total inserted so far: ${totalInserted}`);
  }

  // Also fetch general popular/top-rated movies not tied to a specific service
  console.log("Fetching general popular movies...");
  for (let page = 1; page <= 500; page++) {
    try {
      const result = await discoverMovies(page);
      if (!result?.results || result.results.length === 0) break;

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
          const genreNames = genreIdsToNames(tmdbMovie.genre_ids || []);

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
              genres: JSON.stringify(genreNames),
              lastSyncedAt: new Date().toISOString(),
            })
            .run();

          totalInserted++;
        } catch (e) {
          // skip duplicates silently
        }
      }
    } catch (e) {
      console.error(`Error fetching popular page ${page}:`, e);
    }
  }

  console.log(`Phase 1 complete. ${totalInserted} movies added.`);

  // Phase 1.5: Bulk-populate MPAA ratings via TMDB discover certification filter.
  // This is much faster than individual API calls (Phase 2) because one discover
  // page tags 20 movies at once.
  await populateMpaaRatings();

  console.log(`Phase 1 complete. ${totalInserted} new movies added.`);

  // Phase 2 used to early-return here when totalInserted === 0, which meant
  // that once Phase 1 plateaued (all TMDB discover pages returned only
  // movies we'd already seen), no existing movie ever got topped up with
  // OMDb ratings / imdbId. Result: 12h production uptime with zero
  // Rotten Tomatoes scores. The fix is to ALWAYS run Phase 2 over any
  // movie that's missing enrichment, not gate it on "did we just insert
  // something new?".
  console.log("Starting Phase 2 enrichment...");

  // Phase 2: Enrich movies missing EITHER an imdbId (never enriched) OR a
  // rottenTomatoesScore (imdbId was fetched but OMDb call failed / was
  // rate-limited / OMDB_API_KEY was missing that day).
  const moviesToEnrich = db
    .select({ id: movies.id, tmdbId: movies.tmdbId, title: movies.title })
    .from(movies)
    .where(
      sql`${movies.imdbId} IS NULL OR ${movies.rottenTomatoesScore} IS NULL`,
    )
    .limit(500) // Smaller batch (was 2000) so a single cron completes reliably.
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

      // Preserve Phase 1.5's MPAA rating if it was already set (discover-based
      // certification is more reliable than per-movie release_dates scraping)
      const currentMovie = db.select({ mpaaRating: movies.mpaaRating })
        .from(movies).where(eq(movies.id, movie.id)).get();

      // Pull out production-country ISO codes (e.g. ["US", "GB"]). TMDB
      // returns the full country objects; we only need the ISO code for
      // filtering. Stored as JSON so we can `LIKE '%"US"%'` cheaply.
      const productionCountries =
        details.production_countries?.map((c) => c.iso_3166_1) ?? [];

      db.update(movies)
        .set({
          imdbId: details.imdb_id || null,
          runtimeMinutes: details.runtime || null,
          mpaaRating: currentMovie?.mpaaRating || certifications || null,
          genres: JSON.stringify(genreNames),
          // Phase 2B enrichment — fields previously fetched and discarded.
          originalLanguage: details.original_language || null,
          productionCountries: productionCountries.length
            ? JSON.stringify(productionCountries)
            : null,
          tagline: details.tagline || null,
          budget: details.budget || null,
          revenue: details.revenue || null,
        })
        .where(eq(movies.id, movie.id))
        .run();

      // Get OMDb data (Rotten Tomatoes / Metacritic / IMDb rating).
      // Gated by the module-level circuit breaker: once we've hit a
      // rate-limit or key-config error in this run, stop hammering the
      // API — each call burns ~200ms and has no chance of succeeding
      // until the quota resets at UTC midnight or the key is fixed.
      if (details.imdb_id && !omdbDisabledForRun) {
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
          if (e instanceof OmdbRateLimitError) {
            // Trip the circuit breaker for the remainder of this run.
            omdbDisabledForRun = true;
            lastOmdbFailure = {
              kind: e.kind,
              at: new Date().toISOString(),
              message: e.omdbError,
            };
            console.warn(
              `[orchestrator] OMDb ${e.kind} — skipping remaining OMDb ` +
                `calls for this run. Message: "${e.omdbError}". Quota ` +
                `resets at UTC 00:00; key problems require a .env edit + restart.`,
            );
          } else {
            console.error(`OMDb error for ${movie.title}:`, e);
          }
        }
      }

      // Get watch providers
      try {
        await syncMovieProviders(movie.tmdbId);
      } catch (e) {
        console.error(`Watch providers error for ${movie.title}:`, e);
      }

      // Phase 4C — fetch cast & top crew. Isolated try/catch so a credits
      // failure doesn't block OMDb scores or watch providers from persisting.
      try {
        await syncMovieCast(movie.id, movie.tmdbId);
      } catch (e) {
        console.error(`Cast enrichment error for ${movie.title}:`, e);
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

  // Phase 3: Scrape content ratings (language, violence, etc.) from external sites
  console.log("Starting Phase 3: content rating scraping...");
  try {
    await syncContentRatings();
  } catch (e) {
    console.error("Content rating scraping failed:", e);
  }
}

/**
 * Bulk-populate MPAA ratings by running TMDB discover queries filtered
 * by exact certification (G, PG, PG-13, R). One discover page tags 20
 * movies at once — far faster than the per-movie Phase 2 approach.
 */
async function populateMpaaRatings() {
  const unratedCount = db.select({ count: sql<number>`count(*)` })
    .from(movies)
    .where(isNull(movies.mpaaRating))
    .get()?.count || 0;

  if (unratedCount < 100) {
    console.log(`Only ${unratedCount} movies without MPAA ratings, skipping bulk fetch.`);
    return;
  }

  console.log(`Populating MPAA ratings for ${unratedCount} unrated movies...`);

  const RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
  let totalUpdated = 0;

  for (const rating of RATINGS) {
    let ratingUpdated = 0;

    for (let page = 1; page <= 500; page++) {
      try {
        const result = await discoverMovies(page, { certification: rating });
        if (!result?.results || result.results.length === 0) break;

        for (const tmdbMovie of result.results) {
          const updated = db.update(movies)
            .set({ mpaaRating: rating })
            .where(and(eq(movies.tmdbId, tmdbMovie.id), isNull(movies.mpaaRating)))
            .run();

          if (updated.changes > 0) ratingUpdated++;
        }
      } catch (e) {
        console.error(`Error fetching ${rating} movies page ${page}:`, e);
      }
    }

    totalUpdated += ratingUpdated;
    console.log(`${rating}: tagged ${ratingUpdated} movies`);
  }

  console.log(`MPAA rating population complete. ${totalUpdated} movies tagged.`);
}

// Only store data for these 7 streaming services
const ALLOWED_PROVIDER_IDS = new Set([8, 9, 337, 350, 384, 386, 531]);

/**
 * Fetch TMDB /movie/{id}/credits, map to `movie_cast` rows via the pure
 * mapper, and upsert. Wipes the movie's existing cast rows first so a
 * credits refresh stays in sync with upstream (TMDB occasionally
 * reorders or drops entries).
 */
async function syncMovieCast(movieRowId: number, tmdbId: number) {
  const credits = await getMovieCredits(tmdbId);
  const rows = mapCreditsToRows(credits);
  if (rows.length === 0) return;

  // Replace strategy — simpler than upsert-diff and this runs per-movie
  // inside an otherwise-rare Phase 2 enrichment pass.
  db.delete(movieCast).where(eq(movieCast.movieId, movieRowId)).run();

  for (const row of rows) {
    try {
      db.insert(movieCast)
        .values({ movieId: movieRowId, ...row })
        .run();
    } catch (e) {
      // Unique index collision (same person, same job, same movie) is
      // safe to ignore — means we already inserted this credit on a
      // prior row in the same batch.
      const msg = e instanceof Error ? e.message : "";
      if (!/unique/i.test(msg)) {
        console.error(`[syncMovieCast] insert failed:`, e);
      }
    }
  }
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
      // Skip providers not in our allowed list
      if (!ALLOWED_PROVIDER_IDS.has(provider.provider_id)) continue;
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
    .limit(500) // Was 200 — scrapers are slow, but larger batches shake out more on each daily run.
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

  /**
   * Mature-themes dimensions — only IMDb exposes these. Kept in a closure
   * so we can pull them into the aggregated row below without polluting
   * the cross-source `sources` array.
   */
  let imdbAlcoholDrugsScore: number | null = null;
  let imdbIntenseScenesScore: number | null = null;
  let imdbAlcoholDrugsNotes: string | null = null;
  let imdbIntenseScenesNotes: string | null = null;

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

        // Phase 2B: preserve IMDb's per-category severity for alcohol/drugs
        // and frightening/intense-scenes as separate normalized 0-5 scores.
        // The scraper already pulls these; we were throwing them away.
        imdbAlcoholDrugsScore = normalizeImdbSeverity(
          imdbData.alcoholDrugsSmoking.severity || "None",
        );
        imdbIntenseScenesScore = normalizeImdbSeverity(
          imdbData.frighteningIntenseScenes.severity || "None",
        );
        imdbAlcoholDrugsNotes = imdbData.alcoholDrugsSmoking.notes || null;
        imdbIntenseScenesNotes =
          imdbData.frighteningIntenseScenes.notes || null;
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
          profanityWords: JSON.stringify(
            extractProfanityWords(csmData.language.notes || "")
          ),
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
      // Phase 2B — mature-themes columns. Null unless IMDb scrape succeeded.
      alcoholDrugsScore: imdbAlcoholDrugsScore,
      intenseScenesScore: imdbIntenseScenesScore,
      languageNotes: allLanguageNotes || null,
      violenceNotes: allViolenceNotes || null,
      sexualNotes: allSexualNotes || null,
      scaryNotes: allScaryNotes || null,
      alcoholDrugsNotes: imdbAlcoholDrugsNotes,
      intenseScenesNotes: imdbIntenseScenesNotes,
      specificWords: JSON.stringify(allWords),
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
