import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  movies,
  userMovies,
  userStreamingServices,
  userFilterProfiles,
  contentRatingsAggregated,
  movieProviders,
  streamingProviders,
  recommendationCache,
} from "@/lib/db/schema";
import { getOpenAi, getOpenAiModel, isOpenAiEnabled } from "@/lib/apis/openai";

/**
 * Recommendations engine.
 *
 * Pipeline:
 *   1. buildWatchedSummary(userId)    — compact profile of their taste
 *   2. buildCandidatePool(userId)     — top ~40 unseen movies available on
 *                                        their services within thresholds
 *   3. requestRecommendations()       — OpenAI ranks + writes rationale
 *
 * Exposed to the route as `getRecommendations(userId)`, which handles the
 * 24h cache read-through. Every step returns structured data the route can
 * trivially serialize to JSON.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CANDIDATE_POOL_SIZE = 40;
const WATCHED_SAMPLE_SIZE = 15;
const TARGET_PICK_COUNT = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WatchedSummary {
  sampleSize: number;
  titles: string[];
  genreCounts: Record<string, number>;
  avgImdbRating: number | null;
  decadeCounts: Record<string, number>;
  avgContentScores: {
    language: number;
    violence: number;
    sexual: number;
    scary: number;
  } | null;
}

export interface CandidateMovie {
  id: number;
  title: string;
  year: string | null;
  genres: string[];
  overview: string | null;
  imdbRating: number | null;
  rtScore: number | null;
  mpaaRating: string | null;
  contentScores: {
    language: number | null;
    violence: number | null;
    sexual: number | null;
    scary: number | null;
  };
  availableOn: string[];
}

export interface Recommendation {
  movieId: number;
  reason: string;
}

export type RecommendationsResult =
  | { kind: "ok"; picks: Recommendation[]; pickedAt: string; fromCache: boolean }
  | { kind: "disabled" }
  | { kind: "empty-history" }
  | { kind: "error"; message: string };

// ---------------------------------------------------------------------------
// Watched summary
// ---------------------------------------------------------------------------

export function buildWatchedSummary(userId: string): WatchedSummary | null {
  const rows = db
    .select({
      id: movies.id,
      title: movies.title,
      releaseDate: movies.releaseDate,
      genres: movies.genres,
      imdbRating: movies.imdbRating,
      language: contentRatingsAggregated.languageScore,
      violence: contentRatingsAggregated.violenceScore,
      sexual: contentRatingsAggregated.sexualContentScore,
      scary: contentRatingsAggregated.scaryScore,
    })
    .from(userMovies)
    .innerJoin(movies, eq(userMovies.movieId, movies.id))
    .leftJoin(
      contentRatingsAggregated,
      eq(movies.id, contentRatingsAggregated.movieId),
    )
    .where(
      and(
        eq(userMovies.userId, userId),
        eq(userMovies.status, "watched"),
      ),
    )
    .orderBy(desc(userMovies.updatedAt))
    .limit(WATCHED_SAMPLE_SIZE)
    .all();

  if (rows.length === 0) return null;

  const genreCounts: Record<string, number> = {};
  const decadeCounts: Record<string, number> = {};
  const imdbRatings: number[] = [];
  const lang: number[] = [];
  const viol: number[] = [];
  const sex: number[] = [];
  const scary: number[] = [];

  for (const row of rows) {
    if (row.genres) {
      try {
        const gs = JSON.parse(row.genres) as string[];
        for (const g of gs) genreCounts[g] = (genreCounts[g] ?? 0) + 1;
      } catch {
        /* ignore */
      }
    }
    if (row.releaseDate) {
      const year = parseInt(row.releaseDate.slice(0, 4), 10);
      if (!isNaN(year)) {
        const decade = `${Math.floor(year / 10) * 10}s`;
        decadeCounts[decade] = (decadeCounts[decade] ?? 0) + 1;
      }
    }
    if (typeof row.imdbRating === "number") imdbRatings.push(row.imdbRating);
    if (typeof row.language === "number") lang.push(row.language);
    if (typeof row.violence === "number") viol.push(row.violence);
    if (typeof row.sexual === "number") sex.push(row.sexual);
    if (typeof row.scary === "number") scary.push(row.scary);
  }

  const avg = (xs: number[]) =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

  return {
    sampleSize: rows.length,
    titles: rows.map((r) => r.title),
    genreCounts,
    avgImdbRating: imdbRatings.length > 0 ? Number(avg(imdbRatings).toFixed(1)) : null,
    decadeCounts,
    avgContentScores:
      lang.length > 0
        ? {
            language: Math.round(avg(lang)),
            violence: Math.round(avg(viol)),
            sexual: Math.round(avg(sex)),
            scary: Math.round(avg(scary)),
          }
        : null,
  };
}

// ---------------------------------------------------------------------------
// Candidate pool
// ---------------------------------------------------------------------------

export function buildCandidatePool(userId: string): CandidateMovie[] {
  // User's saved content thresholds (null-safe if they've never saved).
  const profile = db
    .select()
    .from(userFilterProfiles)
    .where(
      and(
        eq(userFilterProfiles.userId, userId),
        eq(userFilterProfiles.isActive, 1),
      ),
    )
    .get();

  // User's subscribed providers. If empty, we fall back to no-provider
  // filter so the feature still works for users who haven't hooked up
  // Settings — the AI just picks from the broader catalog.
  const subscribedProviderIds = db
    .select({ providerId: userStreamingServices.providerId })
    .from(userStreamingServices)
    .where(
      and(
        eq(userStreamingServices.userId, userId),
        eq(userStreamingServices.active, 1),
      ),
    )
    .all()
    .map((r) => r.providerId);

  // Movies already in the user's userMovies table (any status — watched,
  // watchlist, skipped). We don't recommend anything they've already
  // reacted to in any way.
  const seenRows = db
    .select({ movieId: userMovies.movieId })
    .from(userMovies)
    .where(eq(userMovies.userId, userId))
    .all();
  const seenMovieIds = seenRows.map((r) => r.movieId);

  // Content-threshold conditions (only where the user set a sub-5 cap).
  const conditions = [];
  if (seenMovieIds.length > 0) {
    conditions.push(notInArray(movies.id, seenMovieIds));
  }
  if (profile?.maxLanguageScore !== undefined && profile.maxLanguageScore !== null && profile.maxLanguageScore < 5) {
    conditions.push(
      sql`(${contentRatingsAggregated.languageScore} IS NULL OR ${contentRatingsAggregated.languageScore} <= ${profile.maxLanguageScore})`,
    );
  }
  if (profile?.maxViolenceScore !== undefined && profile.maxViolenceScore !== null && profile.maxViolenceScore < 5) {
    conditions.push(
      sql`(${contentRatingsAggregated.violenceScore} IS NULL OR ${contentRatingsAggregated.violenceScore} <= ${profile.maxViolenceScore})`,
    );
  }
  if (profile?.maxSexualContentScore !== undefined && profile.maxSexualContentScore !== null && profile.maxSexualContentScore < 5) {
    conditions.push(
      sql`(${contentRatingsAggregated.sexualContentScore} IS NULL OR ${contentRatingsAggregated.sexualContentScore} <= ${profile.maxSexualContentScore})`,
    );
  }
  if (profile?.maxScaryScore !== undefined && profile.maxScaryScore !== null && profile.maxScaryScore < 5) {
    conditions.push(
      sql`(${contentRatingsAggregated.scaryScore} IS NULL OR ${contentRatingsAggregated.scaryScore} <= ${profile.maxScaryScore})`,
    );
  }

  // Require availability on a subscribed service (if any).
  if (subscribedProviderIds.length > 0) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${movieProviders}
        WHERE ${movieProviders.movieId} = ${movies.id}
          AND ${movieProviders.type} = 'flatrate'
          AND ${inArray(movieProviders.providerId, subscribedProviderIds)}
      )`,
    );
  }

  const rows = db
    .select({
      id: movies.id,
      title: movies.title,
      releaseDate: movies.releaseDate,
      genres: movies.genres,
      overview: movies.overview,
      imdbRating: movies.imdbRating,
      rtScore: movies.rottenTomatoesScore,
      mpaa: movies.mpaaRating,
      language: contentRatingsAggregated.languageScore,
      violence: contentRatingsAggregated.violenceScore,
      sexual: contentRatingsAggregated.sexualContentScore,
      scary: contentRatingsAggregated.scaryScore,
    })
    .from(movies)
    .leftJoin(
      contentRatingsAggregated,
      eq(movies.id, contentRatingsAggregated.movieId),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(movies.popularity))
    .limit(CANDIDATE_POOL_SIZE)
    .all();

  // Batch provider lookup — one query instead of N+1 (was 40 extra queries).
  const movieIds = rows.map((r) => r.id);
  const providerMap = new Map<number, string[]>();
  if (movieIds.length > 0) {
    const providerRows = db
      .select({
        movieId: movieProviders.movieId,
        name: sql<string>`${streamingProviders}.name`,
      })
      .from(movieProviders)
      .innerJoin(
        streamingProviders,
        eq(movieProviders.providerId, streamingProviders.id),
      )
      .where(
        and(
          inArray(movieProviders.movieId, movieIds),
          eq(movieProviders.type, "flatrate"),
          ...(subscribedProviderIds.length > 0
            ? [inArray(movieProviders.providerId, subscribedProviderIds)]
            : []),
        ),
      )
      .all();

    for (const row of providerRows) {
      const list = providerMap.get(row.movieId) ?? [];
      if (row.name && !list.includes(row.name)) list.push(row.name);
      providerMap.set(row.movieId, list);
    }
  }

  return rows.map((r) => {
    let genres: string[] = [];
    if (r.genres) {
      try {
        genres = JSON.parse(r.genres);
      } catch {
        /* ignore */
      }
    }

    return {
      id: r.id,
      title: r.title,
      year: r.releaseDate?.slice(0, 4) ?? null,
      genres,
      overview: r.overview,
      imdbRating: r.imdbRating,
      rtScore: r.rtScore,
      mpaaRating: r.mpaa,
      contentScores: {
        language: r.language,
        violence: r.violence,
        sexual: r.sexual,
        scary: r.scary,
      },
      availableOn: providerMap.get(r.id) ?? [],
    };
  });
}

// ---------------------------------------------------------------------------
// OpenAI call — ranks candidates and returns rationale
// ---------------------------------------------------------------------------

export async function requestRecommendations(
  summary: WatchedSummary,
  candidates: CandidateMovie[],
): Promise<Recommendation[]> {
  const client = getOpenAi();
  if (!client) return [];
  if (candidates.length === 0) return [];

  const topGenres = Object.entries(summary.genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g]) => g);

  const system = [
    "You are a family-film curator for an editorial movie-night app.",
    "The user's content-safety preferences are strict — respect them.",
    "Return STRICT JSON matching the schema: {\"picks\":[{\"movieId\":number,\"reason\":string}]}.",
    "Pick at most " + TARGET_PICK_COUNT + " films from the candidate list.",
    "`reason` is ONE editorial sentence (≤ 180 chars) explaining why THIS film suits THIS viewer,",
    "referencing their watched history or a specific content beat. No hype, no exclamation marks,",
    "no platitudes. Write like Mubi's Notebook, not like a streaming-service blurb.",
  ].join(" ");

  const user = {
    viewer: {
      recentlyWatched: summary.titles,
      topGenres,
      avgImdbRating: summary.avgImdbRating,
      decadeCounts: summary.decadeCounts,
      avgContentScores: summary.avgContentScores,
    },
    candidates: candidates.map((c) => ({
      movieId: c.id,
      title: c.title,
      year: c.year,
      genres: c.genres,
      mpaaRating: c.mpaaRating,
      imdbRating: c.imdbRating,
      rtScore: c.rtScore,
      availableOn: c.availableOn,
      contentScores: c.contentScores,
      blurb: c.overview?.slice(0, 240) ?? null,
    })),
  };

  try {
    const res = await client.chat.completions.create({
      model: getOpenAiModel(),
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
    });

    const content = res.choices[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content) as {
      picks?: Array<{ movieId?: unknown; reason?: unknown }>;
    };

    if (!Array.isArray(parsed.picks)) return [];
    const candidateIds = new Set(candidates.map((c) => c.id));
    return parsed.picks
      .filter(
        (p): p is { movieId: number; reason: string } =>
          typeof p.movieId === "number" &&
          typeof p.reason === "string" &&
          candidateIds.has(p.movieId),
      )
      .slice(0, TARGET_PICK_COUNT);
  } catch (e) {
    console.error("[recommendations] OpenAI call failed:", e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Orchestrator — cache read-through + end-to-end
// ---------------------------------------------------------------------------

export async function getRecommendations(
  userId: string,
): Promise<RecommendationsResult> {
  if (!isOpenAiEnabled()) {
    return { kind: "disabled" };
  }

  // Cache read-through
  const cached = db
    .select()
    .from(recommendationCache)
    .where(eq(recommendationCache.userId, userId))
    .get();

  if (cached) {
    const age = Date.now() - new Date(cached.pickedAt).getTime();
    if (!isNaN(age) && age < CACHE_TTL_MS) {
      try {
        const picks = JSON.parse(cached.picksJson) as Recommendation[];
        return { kind: "ok", picks, pickedAt: cached.pickedAt, fromCache: true };
      } catch {
        // fall through to regenerate
      }
    }
  }

  const summary = buildWatchedSummary(userId);
  if (!summary) return { kind: "empty-history" };

  const candidates = buildCandidatePool(userId);
  if (candidates.length === 0) {
    return { kind: "ok", picks: [], pickedAt: new Date().toISOString(), fromCache: false };
  }

  const picks = await requestRecommendations(summary, candidates);
  const pickedAt = new Date().toISOString();

  db.insert(recommendationCache)
    .values({ userId, picksJson: JSON.stringify(picks), pickedAt })
    .onConflictDoUpdate({
      target: recommendationCache.userId,
      set: { picksJson: JSON.stringify(picks), pickedAt },
    })
    .run();

  return { kind: "ok", picks, pickedAt, fromCache: false };
}

// Exposed for tests so they can override the cache TTL if desired.
export { CACHE_TTL_MS, CANDIDATE_POOL_SIZE, TARGET_PICK_COUNT };
