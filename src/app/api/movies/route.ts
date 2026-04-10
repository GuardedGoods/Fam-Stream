import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  movies,
  contentRatingsAggregated,
  movieProviders,
  streamingProviders,
} from "@/lib/db/schema";
import { eq, like, lte, inArray, desc, asc, sql, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // If requesting providers list
  if (searchParams.get("providers") === "true") {
    try {
      const allProviders = db
        .select()
        .from(streamingProviders)
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
  const hideUnrated = searchParams.get("hideUnrated") === "true";
  const sort = searchParams.get("sort") || "popularity";
  const sortDirection = searchParams.get("sortDirection") || "desc";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "24"), 100);
  const offset = (page - 1) * limit;

  try {
    // Build conditions
    const conditions = [];

    if (search) {
      conditions.push(like(movies.title, `%${search}%`));
    }

    if (mpaaRatings && mpaaRatings.length > 0) {
      conditions.push(inArray(movies.mpaaRating, mpaaRatings));
    }

    if (genres && genres.length > 0) {
      // Filter movies whose genres JSON array contains any of the selected genres
      for (const genre of genres) {
        conditions.push(like(movies.genres, `%${genre}%`));
      }
    }

    // Content score filters - join with aggregated ratings
    if (maxLanguageScore) {
      conditions.push(
        lte(contentRatingsAggregated.languageScore, parseInt(maxLanguageScore))
      );
    }
    if (maxViolenceScore) {
      conditions.push(
        lte(contentRatingsAggregated.violenceScore, parseInt(maxViolenceScore))
      );
    }
    if (maxSexualContentScore) {
      conditions.push(
        lte(
          contentRatingsAggregated.sexualContentScore,
          parseInt(maxSexualContentScore)
        )
      );
    }
    if (maxScaryScore) {
      conditions.push(
        lte(contentRatingsAggregated.scaryScore, parseInt(maxScaryScore))
      );
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

    // Count query
    const hasContentFilters =
      maxLanguageScore ||
      maxViolenceScore ||
      maxSexualContentScore ||
      maxScaryScore ||
      hideUnrated;

    let countResult;
    let movieResults;

    if (hasContentFilters) {
      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      if (hideUnrated) {
        // Inner join - only movies with ratings
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
        // Left join - include unrated
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
      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

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

    // If streaming service filter is set, filter movies that have those providers
    if (streamingServiceIds && streamingServiceIds.length > 0) {
      const movieIds = movieResults.map((m) => m.id);
      if (movieIds.length > 0) {
        const providerLinks = db
          .select({
            movieId: movieProviders.movieId,
          })
          .from(movieProviders)
          .where(
            and(
              inArray(movieProviders.movieId, movieIds),
              inArray(movieProviders.providerId, streamingServiceIds),
              eq(movieProviders.type, "flatrate")
            )
          )
          .all();

        const movieIdsWithProvider = new Set(
          providerLinks.map((p) => p.movieId)
        );
        movieResults = movieResults.filter((m) =>
          movieIdsWithProvider.has(m.id)
        );
      }
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
