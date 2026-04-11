"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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

/** Keys we persist in the URL (page/limit are excluded to reduce noise). */
const URL_FILTER_KEYS = [
  "search",
  "genres",
  "mpaaRatings",
  "maxLanguageScore",
  "maxViolenceScore",
  "maxSexualContentScore",
  "maxScaryScore",
  "streamingServices",
  "hideWatched",
  "hideUnrated",
  "sort",
  "sortDirection",
  "minYear",
  "maxYear",
] as const;

// ---------------------------------------------------------------------------
// Helpers: URL <-> MovieFilters
// ---------------------------------------------------------------------------

function parseFiltersFromURL(params: URLSearchParams): MovieFilters {
  const filters: MovieFilters = {
    page: 1,
    limit: 24,
  };

  const search = params.get("search");
  if (search) filters.search = search;

  const genres = params.get("genres");
  if (genres) filters.genres = genres.split(",");

  const mpaaRatings = params.get("mpaaRatings");
  if (mpaaRatings) filters.mpaaRatings = mpaaRatings.split(",");

  const maxLanguageScore = params.get("maxLanguageScore");
  if (maxLanguageScore !== null) filters.maxLanguageScore = Number(maxLanguageScore);

  const maxViolenceScore = params.get("maxViolenceScore");
  if (maxViolenceScore !== null) filters.maxViolenceScore = Number(maxViolenceScore);

  const maxSexualContentScore = params.get("maxSexualContentScore");
  if (maxSexualContentScore !== null) filters.maxSexualContentScore = Number(maxSexualContentScore);

  const maxScaryScore = params.get("maxScaryScore");
  if (maxScaryScore !== null) filters.maxScaryScore = Number(maxScaryScore);

  const streamingServices = params.get("streamingServices");
  if (streamingServices) filters.streamingServices = streamingServices.split(",").map(Number);

  if (params.get("hideWatched") === "true") filters.hideWatched = true;
  if (params.get("hideUnrated") === "true") filters.hideUnrated = true;

  const sort = params.get("sort");
  if (sort) filters.sort = sort as MovieFilters["sort"];

  const sortDirection = params.get("sortDirection");
  if (sortDirection) filters.sortDirection = sortDirection as MovieFilters["sortDirection"];

  const minYear = params.get("minYear");
  if (minYear !== null) filters.minYear = Number(minYear);

  const maxYear = params.get("maxYear");
  if (maxYear !== null) filters.maxYear = Number(maxYear);

  return filters;
}

function filtersToURLParams(filters: MovieFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.genres?.length) params.set("genres", filters.genres.join(","));
  if (filters.mpaaRatings?.length) params.set("mpaaRatings", filters.mpaaRatings.join(","));
  if (filters.maxLanguageScore !== undefined) params.set("maxLanguageScore", String(filters.maxLanguageScore));
  if (filters.maxViolenceScore !== undefined) params.set("maxViolenceScore", String(filters.maxViolenceScore));
  if (filters.maxSexualContentScore !== undefined) params.set("maxSexualContentScore", String(filters.maxSexualContentScore));
  if (filters.maxScaryScore !== undefined) params.set("maxScaryScore", String(filters.maxScaryScore));
  if (filters.streamingServices?.length) params.set("streamingServices", filters.streamingServices.join(","));
  if (filters.hideWatched) params.set("hideWatched", "true");
  if (filters.hideUnrated) params.set("hideUnrated", "true");
  if (filters.sort && filters.sort !== "popularity") params.set("sort", filters.sort);
  if (filters.sortDirection && filters.sortDirection !== "desc") params.set("sortDirection", filters.sortDirection);
  if (filters.minYear !== undefined) params.set("minYear", String(filters.minYear));
  if (filters.maxYear !== undefined) params.set("maxYear", String(filters.maxYear));

  return params;
}

// ---------------------------------------------------------------------------
// Count how many non-default filters are active (for badge)
// ---------------------------------------------------------------------------

function countActiveFilters(filters: MovieFilters): number {
  let count = 0;
  if (filters.search) count++;
  if (filters.genres?.length) count += filters.genres.length;
  if (filters.mpaaRatings?.length) count += filters.mpaaRatings.length;
  if (filters.maxLanguageScore !== undefined && filters.maxLanguageScore < 5) count++;
  if (filters.maxViolenceScore !== undefined && filters.maxViolenceScore < 5) count++;
  if (filters.maxSexualContentScore !== undefined && filters.maxSexualContentScore < 5) count++;
  if (filters.maxScaryScore !== undefined && filters.maxScaryScore < 5) count++;
  if (filters.streamingServices?.length) count += filters.streamingServices.length;
  if (filters.hideWatched) count++;
  if (filters.hideUnrated) count++;
  if (filters.minYear !== undefined) count++;
  if (filters.maxYear !== undefined) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Active filter chip descriptions
// ---------------------------------------------------------------------------

interface FilterChip {
  label: string;
  onRemove: () => void;
}

function getActiveFilterChips(
  filters: MovieFilters,
  providers: { id: number; name: string }[],
  onFilterChange: (f: Partial<MovieFilters>) => void
): FilterChip[] {
  const chips: FilterChip[] = [];

  // Search
  if (filters.search) {
    chips.push({
      label: `"${filters.search}"`,
      onRemove: () => onFilterChange({ search: undefined }),
    });
  }

  // Genres
  if (filters.genres?.length) {
    for (const genre of filters.genres) {
      chips.push({
        label: genre,
        onRemove: () =>
          onFilterChange({
            genres: filters.genres!.filter((g) => g !== genre),
          }),
      });
    }
  }

  // MPAA ratings
  if (filters.mpaaRatings?.length) {
    for (const rating of filters.mpaaRatings) {
      chips.push({
        label: rating,
        onRemove: () =>
          onFilterChange({
            mpaaRatings: filters.mpaaRatings!.filter((r) => r !== rating),
          }),
      });
    }
  }

  // Content score sliders (only show if below max of 5)
  if (filters.maxLanguageScore !== undefined && filters.maxLanguageScore < 5) {
    chips.push({
      label: `Language \u2264 ${filters.maxLanguageScore}`,
      onRemove: () => onFilterChange({ maxLanguageScore: undefined }),
    });
  }
  if (filters.maxViolenceScore !== undefined && filters.maxViolenceScore < 5) {
    chips.push({
      label: `Violence \u2264 ${filters.maxViolenceScore}`,
      onRemove: () => onFilterChange({ maxViolenceScore: undefined }),
    });
  }
  if (filters.maxSexualContentScore !== undefined && filters.maxSexualContentScore < 5) {
    chips.push({
      label: `Sexual \u2264 ${filters.maxSexualContentScore}`,
      onRemove: () => onFilterChange({ maxSexualContentScore: undefined }),
    });
  }
  if (filters.maxScaryScore !== undefined && filters.maxScaryScore < 5) {
    chips.push({
      label: `Scary \u2264 ${filters.maxScaryScore}`,
      onRemove: () => onFilterChange({ maxScaryScore: undefined }),
    });
  }

  // Streaming services
  if (filters.streamingServices?.length) {
    for (const id of filters.streamingServices) {
      const provider = providers.find((p) => p.id === id);
      chips.push({
        label: provider?.name ?? `Service ${id}`,
        onRemove: () =>
          onFilterChange({
            streamingServices: filters.streamingServices!.filter(
              (s) => s !== id
            ),
          }),
      });
    }
  }

  // Year range
  if (filters.minYear !== undefined && filters.maxYear !== undefined) {
    chips.push({
      label: `${filters.minYear}\u2013${filters.maxYear}`,
      onRemove: () => onFilterChange({ minYear: undefined, maxYear: undefined }),
    });
  } else if (filters.minYear !== undefined) {
    chips.push({
      label: `From ${filters.minYear}`,
      onRemove: () => onFilterChange({ minYear: undefined }),
    });
  } else if (filters.maxYear !== undefined) {
    chips.push({
      label: `Through ${filters.maxYear}`,
      onRemove: () => onFilterChange({ maxYear: undefined }),
    });
  }

  // Boolean toggles
  if (filters.hideWatched) {
    chips.push({
      label: "Hide Watched",
      onRemove: () => onFilterChange({ hideWatched: false }),
    });
  }
  if (filters.hideUnrated) {
    chips.push({
      label: "Hide Unrated",
      onRemove: () => onFilterChange({ hideUnrated: false }),
    });
  }

  return chips;
}

// ---------------------------------------------------------------------------
// Inner component (needs useSearchParams wrapped in Suspense)
// ---------------------------------------------------------------------------

function MoviesPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [movies, setMovies] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [providers, setProviders] = useState<
    { id: number; name: string; logoPath: string | null }[]
  >([]);
  const [total, setTotal] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const initChecked = useRef(false);

  // Initialize filters from URL search params (supports back-button / refresh / sharing)
  const [filters, setFilters] = useState<MovieFilters>(() =>
    parseFiltersFromURL(searchParams)
  );

  // Ref to prevent the initial URL update triggered by mounting
  const isInitialMount = useRef(true);

  // Sync filter state -> URL whenever filters change (skip first render to
  // avoid replacing the URL with the same params we just read from it).
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const urlParams = filtersToURLParams(filters);
    const qs = urlParams.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    router.replace(newUrl, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

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
      if (filters.minYear !== undefined)
        params.set("minYear", String(filters.minYear));
      if (filters.maxYear !== undefined)
        params.set("maxYear", String(filters.maxYear));

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
        if (data.status === "error") {
          setSyncError(data.error);
          return;
        }
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
    setFilters((prev) => ({ ...prev, search: query || undefined, page: 1 }));
  };

  const handleClearAllFilters = () => {
    setFilters({
      sort: "popularity",
      sortDirection: "desc",
      page: 1,
      limit: 24,
    });
  };

  const handleLoadMore = () => {
    setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }));
  };

  const totalPages = Math.ceil(total / (filters.limit || 24));
  const activeFilterCount = countActiveFilters(filters);
  const filterChips = getActiveFilterChips(filters, providers, handleFilterChange);

  return (
    <div className="container mx-auto px-4 max-w-7xl py-6">
      {/* Sync Error Banner */}
      {syncError && (
        <div className="mb-6 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <p className="font-medium text-destructive">Sync Error</p>
          <p className="text-sm text-muted-foreground mt-1">{syncError}</p>
        </div>
      )}

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
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {filterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {filterChips.map((chip, i) => (
            <span
              key={`${chip.label}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {filterChips.length > 1 && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              Clear All
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

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

// ---------------------------------------------------------------------------
// Exported page: wrap in Suspense because useSearchParams requires it for
// prerendering (see Next.js docs on useSearchParams).
// ---------------------------------------------------------------------------

export default function MoviesPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 max-w-7xl py-6">
          <h1 className="text-2xl md:text-3xl font-bold">Browse Movies</h1>
          <p className="text-sm text-muted-foreground mt-1">Loading...</p>
        </div>
      }
    >
      <MoviesPageInner />
    </Suspense>
  );
}
