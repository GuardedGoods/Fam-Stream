"use client";

import { useState, useEffect } from "react";
import { MovieGrid } from "@/components/movie-grid";
import { ListChecks, Eye } from "lucide-react";

type Tab = "watchlist" | "watched";

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
    <div className="container mx-auto px-4 max-w-7xl py-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">My Movies</h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit mb-8">
        <button
          onClick={() => setTab("watchlist")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "watchlist"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ListChecks className="h-4 w-4" />
          To Watch
          {!loading && tab !== "watchlist" && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {movies.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("watched")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "watched"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Eye className="h-4 w-4" />
          Watched
        </button>
      </div>

      <MovieGrid movies={movies} loading={loading} />

      {!loading && movies.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {tab === "watchlist"
              ? "Your watchlist is empty. Browse movies and add some!"
              : "You haven't marked any movies as watched yet."}
          </p>
        </div>
      )}
    </div>
  );
}
