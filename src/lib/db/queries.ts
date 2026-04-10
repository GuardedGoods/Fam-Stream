import { eq, and, or, like, lte, gte, sql, inArray, desc, asc } from 'drizzle-orm';
import { db } from './index';
import {
  movies,
  contentRatings,
  contentRatingsAggregated,
  movieProviders,
  streamingProviders,
} from './schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortField = 'title' | 'releaseDate' | 'popularity' | 'imdbRating' | 'rottenTomatoesScore';
export type SortOrder = 'asc' | 'desc';

export interface GetMoviesFilters {
  /** Maximum MPAA rating: movies at or below this level */
  maxMpaa?: string;
  /** Maximum normalized language score (0-5) */
  maxLanguageScore?: number;
  /** Maximum normalized violence score (0-5) */
  maxViolenceScore?: number;
  /** Maximum normalized sexual content score (0-5) */
  maxSexualContentScore?: number;
  /** Maximum normalized scary score (0-5) */
  maxScaryScore?: number;
  /** Filter by streaming provider id */
  providerIds?: number[];
  /** Filter by genre name (case-insensitive partial match within the JSON array) */
  genre?: string;
  /** Free-text search on title and overview */
  search?: string;
  /** Sort field */
  sortBy?: SortField;
  /** Sort direction */
  sortOrder?: SortOrder;
  /** Page number (1-based) */
  page?: number;
  /** Results per page */
  pageSize?: number;
}

export interface UpsertMovieData {
  tmdbId: number;
  imdbId?: string | null;
  title: string;
  slug: string;
  overview?: string | null;
  releaseDate?: string | null;
  runtimeMinutes?: number | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  mpaaRating?: string | null;
  imdbRating?: number | null;
  rottenTomatoesScore?: number | null;
  metacriticScore?: number | null;
  popularity?: number | null;
  genres?: string | null;
  aiSummary?: string | null;
  lastSyncedAt?: string | null;
}

export interface UpsertContentRatingData {
  movieId: number;
  source: string;
  languageScore?: number | null;
  violenceScore?: number | null;
  sexualContentScore?: number | null;
  scaryScore?: number | null;
  languageNotes?: string | null;
  violenceNotes?: string | null;
  sexualNotes?: string | null;
  scaryNotes?: string | null;
  profanityWords?: string | null;
  recommendedAge?: number | null;
  sourceUrl?: string | null;
}

// ---------------------------------------------------------------------------
// MPAA ordering helper
// ---------------------------------------------------------------------------

const MPAA_LEVELS: Record<string, number> = {
  G: 1,
  PG: 2,
  'PG-13': 3,
  R: 4,
  'NC-17': 5,
};

function mpaaAtOrBelow(maxMpaa: string): string[] {
  const maxLevel = MPAA_LEVELS[maxMpaa] ?? 5;
  return Object.entries(MPAA_LEVELS)
    .filter(([, level]) => level <= maxLevel)
    .map(([rating]) => rating);
}

// ---------------------------------------------------------------------------
// getMovies – paginated, filtered, sorted movie list
// ---------------------------------------------------------------------------

export async function getMovies(filters: GetMoviesFilters = {}) {
  const {
    maxMpaa,
    maxLanguageScore,
    maxViolenceScore,
    maxSexualContentScore,
    maxScaryScore,
    providerIds,
    genre,
    search,
    sortBy = 'popularity',
    sortOrder = 'desc',
    page = 1,
    pageSize = 20,
  } = filters;

  const conditions: ReturnType<typeof eq>[] = [];

  // MPAA filter
  if (maxMpaa) {
    const allowed = mpaaAtOrBelow(maxMpaa);
    conditions.push(inArray(movies.mpaaRating, allowed));
  }

  // Content score filters (join to aggregated table)
  if (maxLanguageScore !== undefined) {
    conditions.push(lte(contentRatingsAggregated.languageScore, maxLanguageScore));
  }
  if (maxViolenceScore !== undefined) {
    conditions.push(lte(contentRatingsAggregated.violenceScore, maxViolenceScore));
  }
  if (maxSexualContentScore !== undefined) {
    conditions.push(lte(contentRatingsAggregated.sexualContentScore, maxSexualContentScore));
  }
  if (maxScaryScore !== undefined) {
    conditions.push(lte(contentRatingsAggregated.scaryScore, maxScaryScore));
  }

  // Genre filter (stored as JSON array string, e.g. '["Action","Comedy"]')
  if (genre) {
    conditions.push(like(movies.genres, `%${genre}%`));
  }

  // Free-text search
  if (search) {
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        like(movies.title, searchPattern),
        like(movies.overview, searchPattern),
      )!,
    );
  }

  // Streaming provider filter — use a subquery
  if (providerIds && providerIds.length > 0) {
    conditions.push(
      inArray(
        movies.id,
        db
          .select({ movieId: movieProviders.movieId })
          .from(movieProviders)
          .where(inArray(movieProviders.providerId, providerIds)),
      ),
    );
  }

  // Sort column mapping
  const sortColumnMap = {
    title: movies.title,
    releaseDate: movies.releaseDate,
    popularity: movies.popularity,
    imdbRating: movies.imdbRating,
    rottenTomatoesScore: movies.rottenTomatoesScore,
  } as const;

  const sortColumn = sortColumnMap[sortBy] ?? movies.popularity;
  const orderFn = sortOrder === 'asc' ? asc : desc;
  const offset = (page - 1) * pageSize;

  // Main query
  const rows = await db
    .select({
      movie: movies,
      aggregated: contentRatingsAggregated,
    })
    .from(movies)
    .leftJoin(
      contentRatingsAggregated,
      eq(movies.id, contentRatingsAggregated.movieId),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderFn(sortColumn))
    .limit(pageSize)
    .offset(offset);

  // Count query for pagination
  const countResult = db
    .select({ count: sql<number>`count(*)` })
    .from(movies)
    .leftJoin(
      contentRatingsAggregated,
      eq(movies.id, contentRatingsAggregated.movieId),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .get();

  const totalCount = countResult?.count ?? 0;

  return {
    movies: rows.map((r) => ({
      ...r.movie,
      aggregatedRating: r.aggregated,
    })),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}

// ---------------------------------------------------------------------------
// getMovieBySlug – single movie with all related data
// ---------------------------------------------------------------------------

export async function getMovieBySlug(slug: string) {
  const movie = await db.query.movies.findFirst({
    where: eq(movies.slug, slug),
    with: {
      contentRatings: true,
      aggregatedRating: true,
      movieProviders: {
        with: {
          provider: true,
        },
      },
    },
  });

  return movie ?? null;
}

// ---------------------------------------------------------------------------
// getMovieById – single movie with all related data
// ---------------------------------------------------------------------------

export async function getMovieById(id: number) {
  const movie = await db.query.movies.findFirst({
    where: eq(movies.id, id),
    with: {
      contentRatings: true,
      aggregatedRating: true,
      movieProviders: {
        with: {
          provider: true,
        },
      },
    },
  });

  return movie ?? null;
}

// ---------------------------------------------------------------------------
// upsertMovie – insert or update a movie by tmdbId
// ---------------------------------------------------------------------------

export async function upsertMovie(data: UpsertMovieData) {
  const existing = db
    .select({ id: movies.id })
    .from(movies)
    .where(eq(movies.tmdbId, data.tmdbId))
    .get();

  if (existing) {
    await db
      .update(movies)
      .set({
        imdbId: data.imdbId ?? undefined,
        title: data.title,
        slug: data.slug,
        overview: data.overview ?? undefined,
        releaseDate: data.releaseDate ?? undefined,
        runtimeMinutes: data.runtimeMinutes ?? undefined,
        posterPath: data.posterPath ?? undefined,
        backdropPath: data.backdropPath ?? undefined,
        mpaaRating: data.mpaaRating ?? undefined,
        imdbRating: data.imdbRating ?? undefined,
        rottenTomatoesScore: data.rottenTomatoesScore ?? undefined,
        metacriticScore: data.metacriticScore ?? undefined,
        popularity: data.popularity ?? undefined,
        genres: data.genres ?? undefined,
        aiSummary: data.aiSummary ?? undefined,
        lastSyncedAt: data.lastSyncedAt ?? new Date().toISOString(),
      })
      .where(eq(movies.id, existing.id));

    return existing.id;
  }

  const result = await db.insert(movies).values({
    tmdbId: data.tmdbId,
    imdbId: data.imdbId,
    title: data.title,
    slug: data.slug,
    overview: data.overview,
    releaseDate: data.releaseDate,
    runtimeMinutes: data.runtimeMinutes,
    posterPath: data.posterPath,
    backdropPath: data.backdropPath,
    mpaaRating: data.mpaaRating,
    imdbRating: data.imdbRating,
    rottenTomatoesScore: data.rottenTomatoesScore,
    metacriticScore: data.metacriticScore,
    popularity: data.popularity,
    genres: data.genres,
    aiSummary: data.aiSummary,
    lastSyncedAt: data.lastSyncedAt ?? new Date().toISOString(),
  });

  return Number(result.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// upsertContentRating – insert or update a content rating by (movieId, source)
// ---------------------------------------------------------------------------

export async function upsertContentRating(data: UpsertContentRatingData) {
  const existing = db
    .select({ id: contentRatings.id })
    .from(contentRatings)
    .where(
      and(
        eq(contentRatings.movieId, data.movieId),
        eq(contentRatings.source, data.source),
      ),
    )
    .get();

  if (existing) {
    await db
      .update(contentRatings)
      .set({
        languageScore: data.languageScore ?? undefined,
        violenceScore: data.violenceScore ?? undefined,
        sexualContentScore: data.sexualContentScore ?? undefined,
        scaryScore: data.scaryScore ?? undefined,
        languageNotes: data.languageNotes ?? undefined,
        violenceNotes: data.violenceNotes ?? undefined,
        sexualNotes: data.sexualNotes ?? undefined,
        scaryNotes: data.scaryNotes ?? undefined,
        profanityWords: data.profanityWords ?? undefined,
        recommendedAge: data.recommendedAge ?? undefined,
        sourceUrl: data.sourceUrl ?? undefined,
        scrapedAt: new Date().toISOString(),
      })
      .where(eq(contentRatings.id, existing.id));

    return existing.id;
  }

  const result = await db.insert(contentRatings).values({
    movieId: data.movieId,
    source: data.source,
    languageScore: data.languageScore,
    violenceScore: data.violenceScore,
    sexualContentScore: data.sexualContentScore,
    scaryScore: data.scaryScore,
    languageNotes: data.languageNotes,
    violenceNotes: data.violenceNotes,
    sexualNotes: data.sexualNotes,
    scaryNotes: data.scaryNotes,
    profanityWords: data.profanityWords,
    recommendedAge: data.recommendedAge,
    sourceUrl: data.sourceUrl,
  });

  return Number(result.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// updateAggregatedRating – recalculate aggregated scores from all sources
// ---------------------------------------------------------------------------

/**
 * Source-specific normalization: each source uses different scales.
 * This function normalizes raw scores from each source to a 0-5 scale.
 */
function normalizeScore(
  rawScore: number | null,
  source: string,
  category: 'language' | 'violence' | 'sexual' | 'scary',
): number | null {
  if (rawScore === null || rawScore === undefined) return null;

  // Kids-in-Mind uses 0-10 for all categories
  if (source === 'kids-in-mind') {
    return Math.round((rawScore / 10) * 5);
  }

  // Common Sense Media uses 0-5 already
  if (source === 'common-sense-media') {
    return Math.min(rawScore, 5);
  }

  // IMDb parents guide uses 0-3 (None/Mild/Moderate/Severe)
  if (source === 'imdb') {
    return Math.round((rawScore / 3) * 5);
  }

  // Dove uses 0-3 scale
  if (source === 'dove') {
    return Math.round((rawScore / 3) * 5);
  }

  // AI-estimated and manual are assumed to already be on 0-5
  return Math.min(rawScore, 5);
}

export async function updateAggregatedRating(movieId: number) {
  // Fetch all content rating sources for this movie
  const sources = db
    .select()
    .from(contentRatings)
    .where(eq(contentRatings.movieId, movieId))
    .all();

  if (sources.length === 0) {
    // Remove aggregated entry if no sources remain
    await db
      .delete(contentRatingsAggregated)
      .where(eq(contentRatingsAggregated.movieId, movieId));
    return null;
  }

  // Normalize and average each category
  const categories = ['language', 'violence', 'sexual', 'scary'] as const;
  type CategoryKey = (typeof categories)[number];

  const scoreFieldMap: Record<CategoryKey, keyof typeof contentRatings.$inferSelect> = {
    language: 'languageScore',
    violence: 'violenceScore',
    sexual: 'sexualContentScore',
    scary: 'scaryScore',
  };

  const notesFieldMap: Record<CategoryKey, keyof typeof contentRatings.$inferSelect> = {
    language: 'languageNotes',
    violence: 'violenceNotes',
    sexual: 'sexualNotes',
    scary: 'scaryNotes',
  };

  const aggregated: Record<string, number | null> = {};
  const combinedNotes: Record<string, string> = {};

  for (const cat of categories) {
    const normalizedScores: number[] = [];

    for (const s of sources) {
      const raw = s[scoreFieldMap[cat]] as number | null;
      const normalized = normalizeScore(raw, s.source, cat);
      if (normalized !== null) {
        normalizedScores.push(normalized);
      }
    }

    if (normalizedScores.length > 0) {
      // Use the maximum score across sources (conservative/safest approach)
      aggregated[cat] = Math.max(...normalizedScores);
    } else {
      aggregated[cat] = null;
    }

    // Combine notes from all sources
    const allNotes: string[] = [];
    for (const s of sources) {
      const note = s[notesFieldMap[cat]] as string | null;
      if (note) {
        allNotes.push(`[${s.source}] ${note}`);
      }
    }
    combinedNotes[cat] = allNotes.join(' | ');
  }

  // Collect all specific profanity words across sources
  const allWords = new Set<string>();
  for (const s of sources) {
    if (s.profanityWords) {
      try {
        const parsed = JSON.parse(s.profanityWords);
        if (typeof parsed === 'object' && parsed !== null) {
          Object.keys(parsed).forEach((w) => allWords.add(w));
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }

  const specificWords = allWords.size > 0 ? JSON.stringify([...allWords]) : null;
  const now = new Date().toISOString();

  // Check if aggregated row already exists
  const existing = db
    .select({ id: contentRatingsAggregated.id })
    .from(contentRatingsAggregated)
    .where(eq(contentRatingsAggregated.movieId, movieId))
    .get();

  if (existing) {
    await db
      .update(contentRatingsAggregated)
      .set({
        languageScore: aggregated.language,
        violenceScore: aggregated.violence,
        sexualContentScore: aggregated.sexual,
        scaryScore: aggregated.scary,
        languageNotes: combinedNotes.language || null,
        violenceNotes: combinedNotes.violence || null,
        sexualNotes: combinedNotes.sexual || null,
        scaryNotes: combinedNotes.scary || null,
        specificWords,
        updatedAt: now,
      })
      .where(eq(contentRatingsAggregated.id, existing.id));

    return existing.id;
  }

  const result = await db.insert(contentRatingsAggregated).values({
    movieId,
    languageScore: aggregated.language,
    violenceScore: aggregated.violence,
    sexualContentScore: aggregated.sexual,
    scaryScore: aggregated.scary,
    languageNotes: combinedNotes.language || null,
    violenceNotes: combinedNotes.violence || null,
    sexualNotes: combinedNotes.sexual || null,
    scaryNotes: combinedNotes.scary || null,
    specificWords,
    updatedAt: now,
  });

  return Number(result.lastInsertRowid);
}
