/**
 * Client-side helpers for mutating the signed-in user's watchlist entry
 * for a movie. Extracted into a dedicated module so the fetch URLs and
 * body shapes can be unit-tested — a prior bug shipped the wrong URL
 * (`/api/watchlist` vs. `/api/user/watchlist`) and the button silently
 * 404'd.
 */
export type WatchlistStatus = "watchlist" | "watched" | null;

const ENDPOINT = "/api/user/watchlist";

/**
 * Upsert or delete the signed-in user's status for a movie.
 *
 *   status = "watchlist" | "watched" → POST (upsert)
 *   status = null                    → DELETE (remove the row)
 *
 * This split exists because `user_movies.status` is NOT NULL in the
 * schema. POSTing `{status: null}` would throw a constraint violation
 * on the server, surface as a 500, and roll back optimistic UI state
 * silently. Removal has always been a separate DELETE endpoint — the
 * client helper now routes there when appropriate so components can
 * stay agnostic about the URL shape.
 */
export async function updateWatchlistStatus(
  movieId: number,
  newStatus: WatchlistStatus,
): Promise<void> {
  if (newStatus === null) {
    const res = await fetch(ENDPOINT, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId }),
    });
    if (!res.ok) {
      throw new Error(
        `Failed to remove from watchlist: ${res.status} ${res.statusText}`,
      );
    }
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ movieId, status: newStatus }),
  });

  if (!res.ok) {
    throw new Error(
      `Failed to update watchlist: ${res.status} ${res.statusText}`,
    );
  }
}
