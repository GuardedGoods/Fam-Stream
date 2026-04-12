/**
 * Client-side helper for mutating the signed-in user's watchlist entry for a
 * movie. Extracted so the fetch URL and body shape can be unit-tested —
 * a prior bug shipped the wrong URL (`/api/watchlist` instead of
 * `/api/user/watchlist`) and the button silently 404'd.
 */
export type WatchlistStatus = "watchlist" | "watched" | null;

export async function updateWatchlistStatus(
  movieId: number,
  newStatus: WatchlistStatus,
): Promise<void> {
  const res = await fetch("/api/user/watchlist", {
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
