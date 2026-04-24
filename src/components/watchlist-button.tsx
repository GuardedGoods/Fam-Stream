"use client";

import { useState } from "react";
import { Bookmark, Check, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  updateWatchlistStatus,
  type WatchlistStatus,
} from "@/lib/watchlist/client";

interface WatchlistButtonProps {
  movieId: number;
  currentStatus: WatchlistStatus;
  className?: string;
}

/**
 * Two independent toggles — "Watchlist" and "Watched" — rendered side by
 * side. Per-movie status is still a mutex in the DB (a row can be
 * `watchlist` OR `watched`, never both), so toggling one off or switching
 * to the other is modeled as a single upsert or delete.
 *
 *   Click Watchlist when null       → set "watchlist"
 *   Click Watchlist when "watchlist" → DELETE (toggle off)
 *   Click Watchlist when "watched"  → switch to "watchlist"
 *   Click Watched when null          → set "watched" (direct, no pre-step)
 *   Click Watched when "watched"     → DELETE (toggle off)
 *   Click Watched when "watchlist"  → switch to "watched"
 *
 * Errors are surfaced inline for ~4 seconds so users can see what went
 * wrong (a previous version swallowed every error silently, which made
 * server-side bugs look like "the button does nothing").
 */
export function WatchlistButton({
  movieId,
  currentStatus,
  className,
}: WatchlistButtonProps) {
  const [status, setStatus] = useState<WatchlistStatus>(currentStatus);
  const [loading, setLoading] = useState<"watchlist" | "watched" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(target: "watchlist" | "watched") {
    // Clicking the already-active toggle clears it. Clicking the other
    // one replaces the current status.
    const nextStatus: WatchlistStatus = status === target ? null : target;
    const previous = status;

    setError(null);
    setStatus(nextStatus);
    setLoading(target);

    try {
      await updateWatchlistStatus(movieId, nextStatus);
    } catch (e) {
      setStatus(previous);
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      // Clear the error after 4s so it doesn't linger forever.
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(null);
    }
  }

  const onWatchlist = status === "watchlist";
  const watched = status === "watched";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Watchlist toggle */}
        <Button
          variant={onWatchlist ? "default" : "outline"}
          size="sm"
          onClick={() => toggle("watchlist")}
          disabled={loading !== null}
          aria-pressed={onWatchlist}
          className="min-w-[10rem]"
        >
          {loading === "watchlist" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Bookmark
              className="h-4 w-4 mr-1"
              fill={onWatchlist ? "currentColor" : "none"}
            />
          )}
          {onWatchlist ? "On Watchlist" : "Add to Watchlist"}
        </Button>

        {/* Watched toggle — always available; no need to add-to-watchlist first */}
        <Button
          variant={watched ? "default" : "outline"}
          size="sm"
          onClick={() => toggle("watched")}
          disabled={loading !== null}
          aria-pressed={watched}
          className={cn(
            "min-w-[10rem]",
            watched && "bg-[var(--score-0)] hover:bg-[var(--score-0)]/90 text-white border-[var(--score-0)]",
          )}
        >
          {loading === "watched" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1" strokeWidth={watched ? 3 : 2} />
          )}
          {watched ? "Watched" : "Mark Watched"}
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="inline-flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2.5 py-1.5 max-w-md"
        >
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}
    </div>
  );
}
