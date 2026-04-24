import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  userMovies,
  movies,
  contentRatingsAggregated,
  users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

/**
 * Ensure the signed-in user has a row in the `users` table before we try to
 * insert a row that FK-references it. With JWT strategy + Drizzle adapter,
 * there are edge cases (stale JWTs from before the adapter was wired, race
 * conditions, /dev DB wipe without re-login) where session.user.id is set
 * but no matching row exists. Without this upsert the userMovies insert
 * throws "FOREIGN KEY constraint failed" → 500.
 *
 * Idempotent: ON CONFLICT DO NOTHING means an existing user row is left
 * alone (name/email/image stay whatever the adapter stored on first sign-in).
 */
function ensureUserRow(session: {
  user?: { id?: string; email?: string | null; name?: string | null; image?: string | null };
}): void {
  const id = session.user?.id;
  if (!id) return;
  db.insert(users)
    .values({
      id,
      email: session.user?.email ?? null,
      name: session.user?.name ?? null,
      image: session.user?.image ?? null,
    })
    .onConflictDoNothing()
    .run();
}

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

    if (!movieId || typeof movieId !== "number" || movieId <= 0 || !Number.isInteger(movieId)) {
      return NextResponse.json(
        { error: "movieId must be a positive integer" },
        { status: 400 }
      );
    }

    // Defensive FK guard — see ensureUserRow() comment above.
    ensureUserRow(session);

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
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to update watchlist:", error);
    // Return the actual DB/runtime error message so the client-side inline
    // error surface can display it — makes diagnosing future failures
    // one-click instead of "check the server logs".
    return NextResponse.json(
      { error: "Failed to update watchlist", details: message },
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

    if (!movieId || typeof movieId !== "number" || movieId <= 0 || !Number.isInteger(movieId)) {
      return NextResponse.json(
        { error: "movieId must be a positive integer" },
        { status: 400 },
      );
    }

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
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to remove from watchlist:", error);
    return NextResponse.json(
      { error: "Failed to remove from watchlist", details: message },
      { status: 500 }
    );
  }
}
