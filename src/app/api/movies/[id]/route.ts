import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  movies,
  contentRatings,
  contentRatingsAggregated,
  movieProviders,
  streamingProviders,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Try to find by slug first, then by id
    let movie;
    const idNum = parseInt(id);
    if (isNaN(idNum)) {
      // It's a slug
      movie = db
        .select()
        .from(movies)
        .where(eq(movies.slug, id))
        .get();
    } else {
      movie = db
        .select()
        .from(movies)
        .where(eq(movies.id, idNum))
        .get();
    }

    if (!movie) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }

    // Get aggregated content rating
    const aggregated = db
      .select()
      .from(contentRatingsAggregated)
      .where(eq(contentRatingsAggregated.movieId, movie.id))
      .get();

    // Get all content rating sources
    const sources = db
      .select()
      .from(contentRatings)
      .where(eq(contentRatings.movieId, movie.id))
      .all();

    // Get streaming providers
    const providers = db
      .select({
        id: streamingProviders.id,
        name: streamingProviders.name,
        logoPath: streamingProviders.logoPath,
        type: movieProviders.type,
        link: movieProviders.link,
      })
      .from(movieProviders)
      .innerJoin(
        streamingProviders,
        eq(movieProviders.providerId, streamingProviders.id)
      )
      .where(eq(movieProviders.movieId, movie.id))
      .all();

    // Format response
    const response = {
      ...movie,
      genres: movie.genres ? JSON.parse(movie.genres) : [],
      contentRating: aggregated
        ? {
            languageScore: aggregated.languageScore,
            violenceScore: aggregated.violenceScore,
            sexualContentScore: aggregated.sexualContentScore,
            scaryScore: aggregated.scaryScore,
            languageNotes: aggregated.languageNotes,
            violenceNotes: aggregated.violenceNotes,
            sexualNotes: aggregated.sexualNotes,
            scaryNotes: aggregated.scaryNotes,
            specificWords: aggregated.specificWords
              ? JSON.parse(aggregated.specificWords)
              : [],
          }
        : null,
      contentSources: sources.map((s) => ({
        source: s.source,
        languageScore: s.languageScore,
        violenceScore: s.violenceScore,
        sexualContentScore: s.sexualContentScore,
        scaryScore: s.scaryScore,
        languageNotes: s.languageNotes,
        violenceNotes: s.violenceNotes,
        sexualNotes: s.sexualNotes,
        scaryNotes: s.scaryNotes,
        profanityWords: s.profanityWords
          ? JSON.parse(s.profanityWords)
          : {},
        recommendedAge: s.recommendedAge,
        sourceUrl: s.sourceUrl,
      })),
      streamingProviders: providers,
      userStatus: null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch movie:", error);
    return NextResponse.json(
      { error: "Failed to fetch movie" },
      { status: 500 }
    );
  }
}
