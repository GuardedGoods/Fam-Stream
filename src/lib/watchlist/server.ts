import { db } from "@/lib/db";
import { userMovies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import type { WatchlistStatus } from "./client";

/**
 * Look up the current signed-in user's saved status for a given movie.
 * Returns `null` when the user is not signed in, has no entry for the
 * movie, or has an entry with a non-visible status (e.g. "skipped") — all
 * of which render as "Add to Watchlist" on the client.
 */
export async function getUserMovieStatus(
  movieId: number,
): Promise<WatchlistStatus> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const row = db
    .select({ status: userMovies.status })
    .from(userMovies)
    .where(
      and(
        eq(userMovies.userId, session.user.id),
        eq(userMovies.movieId, movieId),
      ),
    )
    .get();

  if (row?.status === "watchlist" || row?.status === "watched") {
    return row.status;
  }
  return null;
}
