"use client";

import { useState, useEffect } from "react";
import { MovieGrid } from "@/components/movie-grid";

type Tab = "watchlist" | "watched";

/**
 * /watchlist — user's saved films.
 *
 * Editorial refresh: Fraunces masthead, small-caps tab pair (single-line
 * tabs split by a thin rule, not pill-shaped segmented control), quiet
 * empty states that match the "Not yet rated" pattern from the detail page.
 */
export default function WatchlistPage() {
  const [tab, setTab] = useState<Tab>("watchlist");
  const [movies, setMovies] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/user/watchlist?status=${tab}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then((data) => {
        setMovies(data.movies || []);
      })
      .catch(() => {
        setMovies([]);
      })
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="container mx-auto px-4 sm:px-6 max-w-7xl py-10">
      <header className="mb-10">
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl leading-[0.95] tracking-tight">
          My Films
        </h1>
        <p className="small-caps text-[11px] text-muted-foreground mt-2">
          Saved for later · Seen so far
        </p>
      </header>

      {/* Tabs — a single rule with two underlined picks. No pill segmented
          control (the SaaS tell). */}
      <div
        role="tablist"
        aria-label="Watchlist sections"
        className="flex items-center gap-8 mb-10 border-b border-border"
      >
        <TabButton
          active={tab === "watchlist"}
          onClick={() => setTab("watchlist")}
          label="To Watch"
        />
        <TabButton
          active={tab === "watched"}
          onClick={() => setTab("watched")}
          label="Watched"
        />
      </div>

      {loading || movies.length > 0 ? (
        <MovieGrid movies={movies} loading={loading} />
      ) : (
        <div className="border border-dashed border-border bg-muted/30 p-10 text-center">
          <h2 className="font-serif text-2xl">
            {tab === "watchlist" ? "Nothing saved yet" : "Nothing marked yet"}
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-sm mx-auto">
            {tab === "watchlist"
              ? "Tap the bookmark on any film to save it here for later."
              : "Tap Mark Watched on a film's page to add it to this list."}
          </p>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`small-caps text-[12px] py-4 -mb-px border-b-2 transition-colors ${
        active
          ? "text-foreground border-primary"
          : "text-muted-foreground border-transparent hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
