"use client";

import { useState } from "react";
import { Plus, Check, Eye, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface WatchlistButtonProps {
  movieId: number;
  currentStatus: "watchlist" | "watched" | null;
  className?: string;
}

export function WatchlistButton({
  movieId,
  currentStatus,
  className,
}: WatchlistButtonProps) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: "watchlist" | "watched" | null) {
    const previousStatus = status;
    setStatus(newStatus);
    setLoading(true);

    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieId,
          status: newStatus,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update watchlist");
      }
    } catch {
      // Rollback on error
      setStatus(previousStatus);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button variant="outline" size="sm" disabled>
          <Loader2 className="h-4 w-4 animate-spin" />
          Updating...
        </Button>
      </div>
    );
  }

  if (status === null) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateStatus("watchlist")}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add to Watchlist
        </Button>
      </div>
    );
  }

  if (status === "watchlist") {
    return (
      <div className={cn("flex items-center gap-2 flex-wrap", className)}>
        <Button
          variant="default"
          size="sm"
          onClick={() => updateStatus("watched")}
        >
          <Eye className="h-4 w-4 mr-1" />
          Mark Watched
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => updateStatus(null)}
          className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Remove
        </Button>
      </div>
    );
  }

  // status === "watched"
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <Button variant="secondary" size="sm" disabled>
        <Check className="h-4 w-4 mr-1" />
        Watched
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => updateStatus("watchlist")}
        className="text-gray-500 dark:text-gray-400"
      >
        Move to Watchlist
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => updateStatus(null)}
        className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
      >
        <Trash2 className="h-4 w-4 mr-1" />
        Remove
      </Button>
    </div>
  );
}
