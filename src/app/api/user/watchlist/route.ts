import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userMovies, movies, contentRatingsAggregated } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status") || "watchlist";

  try {
    const results = db
      .select({
        id: movies.id,
        tmdbId: movies.tmdbId,
        title: movies.title,
        slug: movies.slug,
        overview: movies.overview,
        releaseDate: movies.releaseDate,
        runtimeMinutes: movies.runtimeMinutes,
        posterPath: movies.posterPath,
        mpaaRating: movies.mpaaRating,
        imdbRating: movies.imdbRating,
        rottenTomatoesScore: movies.rottenTomatoesScore,
        popularity: movies.popularity,
        genres: movies.genres,
        status: userMovies.status,
        rating: userMovies.rating,
        notes: userMovies.notes,
        languageScore: contentRatingsAggregated.languageScore,
        violenceScore: contentRatingsAggregated.violenceScore,
        sexualContentScore: contentRatingsAggregated.sexualContentScore,
        scaryScore: contentRatingsAggregated.scaryScore,
      })
      .from(userMovies)
      .innerJoin(movies, eq(userMovies.movieId, movies.id))
      .leftJoin(
        contentRatingsAggregated,
        eq(movies.id, contentRatingsAggregated.movieId)
      )
      .where(
        and(
          eq(userMovies.userId, session.user.id),
          eq(userMovies.status, status)
        )
      )
      .all();

    const formattedMovies = results.map((m) => ({
      ...m,
      genres: m.genres ? JSON.parse(m.genres) : [],
      contentRating:
        m.languageScore !== null
          ? {
              languageScore: m.languageScore,
              violenceScore: m.violenceScore,
              sexualContentScore: m.sexualContentScore,
              scaryScore: m.scaryScore,
            }
          : null,
    }));

    return NextResponse.json({ movies: formattedMovies });
  } catch (error) {
    console.error("Failed to fetch watchlist:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { movieId, status = "watchlist" } = await request.json();

    if (!movieId) {
      return NextResponse.json(
        { error: "movieId is required" },
        { status: 400 }
      );
    }

    // Upsert
    const existing = db
      .select()
      .from(userMovies)
      .where(
        and(
          eq(userMovies.userId, session.user.id),
          eq(userMovies.movieId, movieId)
        )
      )
      .get();

    if (existing) {
      db.update(userMovies)
        .set({
          status,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userMovies.id, existing.id))
        .run();
    } else {
      db.insert(userMovies)
        .values({
          userId: session.user.id,
          movieId,
          status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update watchlist:", error);
    return NextResponse.json(
      { error: "Failed to update watchlist" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { movieId } = await request.json();

    db.delete(userMovies)
      .where(
        and(
          eq(userMovies.userId, session.user.id),
          eq(userMovies.movieId, movieId)
        )
      )
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove from watchlist:", error);
    return NextResponse.json(
      { error: "Failed to remove from watchlist" },
      { status: 500 }
    );
  }
}
