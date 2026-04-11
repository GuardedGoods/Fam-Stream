import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  movies,
  contentRatingsAggregated,
  movieProviders,
  streamingProviders,
} from "@/lib/db/schema";
import {
  eq,
  like,
  lte,
  gte,
  inArray,
  desc,
  asc,
  sql,
  and,
  exists,
} from "drizzle-orm";

// The 7 streaming services we support
const ALLOWED_PROVIDER_IDS = [8, 9, 337, 350, 384, 386, 531];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // If requesting providers list
  if (searchParams.get("providers") === "true") {
    try {
      const allProviders = db
        .select()
        .from(streamingProviders)
        .where(inArray(streamingProviders.tmdbProviderId, ALLOWED_PROVIDER_IDS))
        .orderBy(asc(streamingProviders.displayPriority))
        .all();
      return NextResponse.json({ providers: allProviders });
    } catch {
      return NextResponse.json({ providers: [] });
    }
  }

  const search = searchParams.get("search") || undefined;
  const genres = searchParams.get("genres")?.split(",").filter(Boolean);
  const mpaaRatings = searchParams.get("mpaaRatings")?.split(",").filter(Boolean);
  const maxLanguageScore = searchParams.get("maxLanguageScore");
  const maxViolenceScore = searchParams.get("maxViolenceScore");
  const maxSexualContentScore = searchParams.get("maxSexualContentScore");
  const maxScaryScore = searchParams.get("maxScaryScore");
  const streamingServiceIds = searchParams
    .get("streamingServices")
    ?.split(",")
    .filter(Boolean)
    .map(Number);
  const minYear = searchParams.get("minYear");
  const maxYear = searchParams.get("maxYear");
  const blockedWords = searchParams.get("blockedWords")?.split(",").filter(Boolean);
  const hideUnrated = searchParams.get("hideUnrated") === "true";
  const sort = searchParams.get("sort") || "popularity";
  const sortDirection = searchParams.get("sortDirection") || "desc";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "24"), 100);
  const offset = (page - 1) * limit;

  try {
    // Build conditions array — all filters go here so both count and results queries stay in sync
    const conditions = [];

    // Always exclude future/unreleased movies
    const today = new Date().toISOString().slice(0, 10);
    conditions.push(lte(movies.releaseDate, today));

    if (search) {
      conditions.push(like(movies.title, `%${search}%`));
    }

    if (mpaaRatings && mpaaRatings.length > 0) {
      conditions.push(inArray(movies.mpaaRating, mpaaRatings));
    }

    if (genres && genres.length > 0) {
      for (const genre of genres) {
        conditions.push(like(movies.genres, `%${genre}%`));
      }
    }

    // Release year filter
    if (minYear) {
      conditions.push(gte(movies.releaseDate, `${minYear}-01-01`));
    }
    if (maxYear) {
      conditions.push(lte(movies.releaseDate, `${maxYear}-12-31`));
    }

    // Streaming service filter — applied as an EXISTS subquery so pagination is correct.
    // Previously this was applied post-query in memory (broken: showed only 3 results per page).
    if (streamingServiceIds && streamingServiceIds.length > 0) {
      conditions.push(
        exists(
          db
            .select({ one: sql<number>`1` })
            .from(movieProviders)
            .where(
              and(
                eq(movieProviders.movieId, movies.id),
                inArray(movieProviders.providerId, streamingServiceIds),
                eq(movieProviders.type, "flatrate")
              )
            )
        )
      );
    }

    // Content score filters — reference contentRatingsAggregated columns (joined below).
    // When a slider is at 5 (max), no condition is needed — everything passes.
    // When a slider is below 5, we MUST exclude unrated movies because we can't
    // verify they meet the safety criteria. A strict lte() on a LEFT JOIN naturally
    // excludes NULLs (SQL NULL <= N is false), which is the correct family-safe behavior.
    let needsContentJoin = false;

    if (maxLanguageScore) {
      const maxVal = parseInt(maxLanguageScore);
      if (maxVal < 5) {
        conditions.push(lte(contentRatingsAggregated.languageScore, maxVal));
        needsContentJoin = true;
      }
    }
    if (maxViolenceScore) {
      const maxVal = parseInt(maxViolenceScore);
      if (maxVal < 5) {
        conditions.push(lte(contentRatingsAggregated.violenceScore, maxVal));
        needsContentJoin = true;
      }
    }
    if (maxSexualContentScore) {
      const maxVal = parseInt(maxSexualContentScore);
      if (maxVal < 5) {
        conditions.push(lte(contentRatingsAggregated.sexualContentScore, maxVal));
        needsContentJoin = true;
      }
    }
    if (maxScaryScore) {
      const maxVal = parseInt(maxScaryScore);
      if (maxVal < 5) {
        conditions.push(lte(contentRatingsAggregated.scaryScore, maxVal));
        needsContentJoin = true;
      }
    }

    // Blocked words filter — exclude movies whose specificWords JSON contains any blocked word
    if (blockedWords && blockedWords.length > 0) {
      for (const word of blockedWords) {
        conditions.push(
          sql`(${contentRatingsAggregated.specificWords} IS NULL OR ${contentRatingsAggregated.specificWords} NOT LIKE ${'%"' + word + '"%'})`
        );
      }
      needsContentJoin = true;
    }

    // Determine sort column
    let orderBy;
    const dir = sortDirection === "asc" ? asc : desc;
    switch (sort) {
      case "title":
        orderBy = dir(movies.title);
        break;
      case "release_date":
        orderBy = dir(movies.releaseDate);
        break;
      case "imdb_rating":
        orderBy = dir(movies.imdbRating);
        break;
      case "rt_score":
        orderBy = dir(movies.rottenTomatoesScore);
        break;
      default:
        orderBy = dir(movies.popularity);
    }

    const hasContentFilters = needsContentJoin || hideUnrated;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let countResult;
    let movieResults;

    if (hasContentFilters) {
      if (hideUnrated) {
        // Inner join — only movies that have a content rating row
        countResult = db
          .select({ count: sql<number>`count(*)` })
          .from(movies)
          .innerJoin(
            contentRatingsAggregated,
            eq(movies.id, contentRatingsAggregated.movieId)
          )
          .where(whereClause)
          .get();

        movieResults = db
          .select({
            id: movies.id,
            tmdbId: movies.tmdbId,
            title: movies.title,
            slug: movies.slug,
            overview: movies.overview,
            releaseDate: movies.releaseDate,
            runtimeMinutes: movies.runtimeMinutes,
            posterPath: movies.posterPath,
            backdropPath: movies.backdropPath,
            mpaaRating: movies.mpaaRating,
            imdbRating: movies.imdbRating,
            rottenTomatoesScore: movies.rottenTomatoesScore,
            metacriticScore: movies.metacriticScore,
            popularity: movies.popularity,
            genres: movies.genres,
            languageScore: contentRatingsAggregated.languageScore,
            violenceScore: contentRatingsAggregated.violenceScore,
            sexualContentScore: contentRatingsAggregated.sexualContentScore,
            scaryScore: contentRatingsAggregated.scaryScore,
            specificWords: contentRatingsAggregated.specificWords,
          })
          .from(movies)
          .innerJoin(
            contentRatingsAggregated,
            eq(movies.id, contentRatingsAggregated.movieId)
          )
          .where(whereClause)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset)
          .all();
      } else {
        // Left join — include unrated movies; NULL score conditions handled above with OR IS NULL
        countResult = db
          .select({ count: sql<number>`count(*)` })
          .from(movies)
          .leftJoin(
            contentRatingsAggregated,
            eq(movies.id, contentRatingsAggregated.movieId)
          )
          .where(whereClause)
          .get();

        movieResults = db
          .select({
            id: movies.id,
            tmdbId: movies.tmdbId,
            title: movies.title,
            slug: movies.slug,
            overview: movies.overview,
            releaseDate: movies.releaseDate,
            runtimeMinutes: movies.runtimeMinutes,
            posterPath: movies.posterPath,
            backdropPath: movies.backdropPath,
            mpaaRating: movies.mpaaRating,
            imdbRating: movies.imdbRating,
            rottenTomatoesScore: movies.rottenTomatoesScore,
            metacriticScore: movies.metacriticScore,
            popularity: movies.popularity,
            genres: movies.genres,
            languageScore: contentRatingsAggregated.languageScore,
            violenceScore: contentRatingsAggregated.violenceScore,
            sexualContentScore: contentRatingsAggregated.sexualContentScore,
            scaryScore: contentRatingsAggregated.scaryScore,
            specificWords: contentRatingsAggregated.specificWords,
          })
          .from(movies)
          .leftJoin(
            contentRatingsAggregated,
            eq(movies.id, contentRatingsAggregated.movieId)
          )
          .where(whereClause)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset)
          .all();
      }
    } else {
      countResult = db
        .select({ count: sql<number>`count(*)` })
        .from(movies)
        .where(whereClause)
        .get();

      const rawResults = db
        .select()
        .from(movies)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset)
        .all();

      movieResults = rawResults.map((m) => ({
        ...m,
        languageScore: null,
        violenceScore: null,
        sexualContentScore: null,
        scaryScore: null,
        specificWords: null,
      }));
    }

    // Format response
    const data = movieResults.map((m) => ({
      ...m,
      genres: m.genres ? JSON.parse(m.genres) : [],
      contentRating:
        m.languageScore !== null
          ? {
              languageScore: m.languageScore,
              violenceScore: m.violenceScore,
              sexualContentScore: m.sexualContentScore,
              scaryScore: m.scaryScore,
              specificWords: m.specificWords
                ? JSON.parse(m.specificWords)
                : [],
            }
          : null,
      streamingProviders: [],
    }));

    return NextResponse.json({
      data,
      total: countResult?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    });
  } catch (error) {
    console.error("Failed to fetch movies:", error);
    return NextResponse.json(
      { error: "Failed to fetch movies", data: [], total: 0 },
      { status: 500 }
    );
  }
}
