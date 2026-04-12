import { MovieCard, type WatchlistStatus } from "@/components/movie-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MovieWithDetails } from "@/types";

interface MovieGridProps {
  movies: MovieWithDetails[] | unknown[];
  loading?: boolean;
  /**
   * Map of movie.id -> the signed-in user's status for that movie. Movies
   * not in the map render without a watchlist/watched badge.
   */
  watchlistStatusById?: Map<number, Exclude<WatchlistStatus, null>>;
}

function MovieCardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <Skeleton className="aspect-[2/3] w-full rounded-none" />
      <div className="p-2 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-1">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-2 w-2 rounded-full" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-5 w-5 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function MovieGrid({
  movies,
  loading = false,
  watchlistStatusById,
}: MovieGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <MovieCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!movies || movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-gray-400 dark:text-gray-500 mb-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M7 3v18" />
            <path d="M3 7.5h4" />
            <path d="M3 12h18" />
            <path d="M3 16.5h4" />
            <path d="M17 3v18" />
            <path d="M17 7.5h4" />
            <path d="M17 16.5h4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
          No movies found
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Try adjusting your filters or search terms.
        </p>
      </div>
    );
  }

  const typedMovies = movies as MovieWithDetails[];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {typedMovies.map((movie) => (
        <MovieCard
          key={movie.id}
          title={movie.title}
          slug={movie.slug}
          posterPath={movie.posterPath}
          releaseDate={movie.releaseDate}
          mpaaRating={movie.mpaaRating}
          contentRating={movie.contentRating}
          streamingProviders={movie.streamingProviders || []}
          watchlistStatus={watchlistStatusById?.get(movie.id) ?? null}
        />
      ))}
    </div>
  );
}
