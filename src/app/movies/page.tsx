"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MovieGrid } from "@/components/movie-grid";
import { FilterPanel } from "@/components/filter-panel";
import { SearchBar } from "@/components/search-bar";
import { SlidersHorizontal, X, RefreshCw } from "lucide-react";
import type { MovieFilters } from "@/types";

const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
];

export default function MoviesPage() {
  const [movies, setMovies] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [providers, setProviders] = useState<
    { id: number; name: string; logoPath: string | null }[]
  >([]);
  const [total, setTotal] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const initChecked = useRef(false);
  const [filters, setFilters] = useState<MovieFilters>({
    sort: "popularity",
    sortDirection: "desc",
    page: 1,
    limit: 24,
  });

  const fetchMovies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.genres?.length)
        params.set("genres", filters.genres.join(","));
      if (filters.mpaaRatings?.length)
        params.set("mpaaRatings", filters.mpaaRatings.join(","));
      if (filters.maxLanguageScore !== undefined)
        params.set("maxLanguageScore", String(filters.maxLanguageScore));
      if (filters.maxViolenceScore !== undefined)
        params.set("maxViolenceScore", String(filters.maxViolenceScore));
      if (filters.maxSexualContentScore !== undefined)
        params.set(
          "maxSexualContentScore",
          String(filters.maxSexualContentScore)
        );
      if (filters.maxScaryScore !== undefined)
        params.set("maxScaryScore", String(filters.maxScaryScore));
      if (filters.streamingServices?.length)
        params.set("streamingServices", filters.streamingServices.join(","));
      if (filters.hideWatched) params.set("hideWatched", "true");
      if (filters.hideUnrated) params.set("hideUnrated", "true");
      if (filters.sort) params.set("sort", filters.sort);
      if (filters.sortDirection)
        params.set("sortDirection", filters.sortDirection);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));

      const res = await fetch(`/api/movies?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMovies(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch movies:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  // Check if DB needs initial sync
  useEffect(() => {
    if (initChecked.current) return;
    initChecked.current = true;

    fetch("/api/sync/init")
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "sync_started") {
          setSyncing(true);
          // Poll for movies every 5 seconds while syncing
          const interval = setInterval(() => {
            fetch("/api/movies?limit=1")
              .then((r) => r.json())
              .then((d) => {
                if (d.total > 0) {
                  setSyncing(false);
                  clearInterval(interval);
                  fetchMovies();
                  // Refresh providers too
                  fetch("/api/movies?providers=true")
                    .then((r) => r.json())
                    .then((pd) => {
                      if (pd.providers) setProviders(pd.providers);
                    })
                    .catch(() => {});
                }
              })
              .catch(() => {});
          }, 5000);
          // Stop polling after 5 minutes
          setTimeout(() => {
            clearInterval(interval);
            setSyncing(false);
          }, 300000);
        }
      })
      .catch(() => {});
  }, [fetchMovies]);

  useEffect(() => {
    fetch("/api/movies?providers=true")
      .then((r) => r.json())
      .then((data) => {
        if (data.providers) setProviders(data.providers);
      })
      .catch(() => {});
  }, []);

  const handleFilterChange = (newFilters: Partial<MovieFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handleSearch = (query: string) => {
    setFilters((prev) => ({ ...prev, search: query, page: 1 }));
  };

  const handleLoadMore = () => {
    setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }));
  };

  const totalPages = Math.ceil(total / (filters.limit || 24));

  return (
    <div className="container mx-auto px-4 max-w-7xl py-6">
      {/* Syncing Banner */}
      {syncing && (
        <div className="mb-6 p-4 rounded-lg border border-primary/30 bg-primary/5 flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-primary animate-spin" />
          <div>
            <p className="font-medium text-primary">Syncing movie database...</p>
            <p className="text-sm text-muted-foreground">
              Fetching movies from TMDB. This only happens once. Movies will appear shortly.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Browse Movies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total > 0
              ? `${total} movies found`
              : loading
                ? "Loading..."
                : "No movies found"}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:w-72">
            <SearchBar onSearch={handleSearch} initialValue={filters.search} />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors md:hidden"
          >
            {showFilters ? (
              <X className="h-4 w-4" />
            ) : (
              <SlidersHorizontal className="h-4 w-4" />
            )}
            Filters
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Desktop filter sidebar */}
        <aside className="hidden md:block w-72 shrink-0">
          <div className="sticky top-20">
            <FilterPanel
              currentFilters={filters}
              onFilterChange={handleFilterChange}
              streamingProviders={providers}
              genres={GENRES}
            />
          </div>
        </aside>

        {/* Mobile filter overlay */}
        {showFilters && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowFilters(false)}
            />
            <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] bg-background border-l border-border overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Filters</h2>
                <button onClick={() => setShowFilters(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <FilterPanel
                currentFilters={filters}
                onFilterChange={handleFilterChange}
                streamingProviders={providers}
                genres={GENRES}
              />
            </div>
          </div>
        )}

        {/* Movie grid */}
        <div className="flex-1 min-w-0">
          <MovieGrid movies={movies} loading={loading} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() =>
                  setFilters((p) => ({
                    ...p,
                    page: Math.max(1, (p.page || 1) - 1),
                  }))
                }
                disabled={filters.page === 1}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium disabled:opacity-50 hover:bg-accent transition-colors"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-muted-foreground">
                Page {filters.page || 1} of {totalPages}
              </span>
              <button
                onClick={handleLoadMore}
                disabled={(filters.page || 1) >= totalPages}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium disabled:opacity-50 hover:bg-accent transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
