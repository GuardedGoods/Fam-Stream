// ---------------------------------------------------------------------------
// TMDB API Client
// https://developer.themoviedb.org/reference
// ---------------------------------------------------------------------------

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const RATE_LIMIT_MAX = 40;
const RATE_LIMIT_WINDOW_MS = 10_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
  popularity: number;
  vote_average: number;
  vote_count: number;
  adult: boolean;
  original_language: string;
  video: boolean;
}

export interface TmdbMovieDetails {
  id: number;
  imdb_id: string | null;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  runtime: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: TmdbGenre[];
  popularity: number;
  vote_average: number;
  vote_count: number;
  adult: boolean;
  budget: number;
  revenue: number;
  status: string;
  tagline: string | null;
  homepage: string | null;
  production_companies: TmdbProductionCompany[];
  spoken_languages: TmdbSpokenLanguage[];
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface TmdbSpokenLanguage {
  english_name: string;
  iso_639_1: string;
  name: string;
}

export interface TmdbPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbReleaseDateEntry {
  certification: string;
  descriptors: string[];
  iso_639_1: string;
  note: string;
  release_date: string;
  type: number; // 1=Premiere, 2=Theatrical (limited), 3=Theatrical, 4=Digital, 5=Physical, 6=TV
}

export interface TmdbReleaseDateCountry {
  iso_3166_1: string;
  release_dates: TmdbReleaseDateEntry[];
}

export interface TmdbReleaseDatesResponse {
  id: number;
  results: TmdbReleaseDateCountry[];
}

export interface TmdbWatchProvider {
  logo_path: string;
  provider_id: number;
  provider_name: string;
  display_priority: number;
}

export interface TmdbWatchProviderCountry {
  link: string;
  flatrate?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
  ads?: TmdbWatchProvider[];
  free?: TmdbWatchProvider[];
}

export interface TmdbWatchProvidersResponse {
  id: number;
  results: Record<string, TmdbWatchProviderCountry>;
}

// ---------------------------------------------------------------------------
// Rate limiter – simple sliding-window queue
// ---------------------------------------------------------------------------

class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {}

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 50; // 50ms buffer
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.waitForSlot();
    }

    this.timestamps.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB_API_KEY environment variable is not set');
  }
  return key;
}

async function tmdbFetch<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  await rateLimiter.waitForSlot();

  const apiKey = getApiKey();
  const url = new URL(`${TMDB_BASE_URL}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `TMDB API error: ${response.status} ${response.statusText} – ${body}`,
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover popular movies with optional genre and rating filters.
 */
export async function discoverMovies(
  page: number = 1,
  options?: { genres?: number[]; maxRating?: string },
): Promise<TmdbPaginatedResponse<TmdbMovie>> {
  const params: Record<string, string> = {
    page: String(page),
    sort_by: 'popularity.desc',
    include_adult: 'false',
    include_video: 'false',
    language: 'en-US',
  };

  if (options?.genres && options.genres.length > 0) {
    params.with_genres = options.genres.join(',');
  }

  if (options?.maxRating) {
    params.certification_country = 'US';
    params['certification.lte'] = options.maxRating;
  }

  return tmdbFetch<TmdbPaginatedResponse<TmdbMovie>>(
    '/discover/movie',
    params,
  );
}

/**
 * Get full movie details including runtime, genres, and overview.
 */
export async function getMovieDetails(
  tmdbId: number,
): Promise<TmdbMovieDetails> {
  return tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`, {
    language: 'en-US',
  });
}

/**
 * Get MPAA certification (US rating) for a movie.
 * Returns the certification string (e.g. "PG", "PG-13") or null if not found.
 */
export async function getMovieCertifications(
  tmdbId: number,
): Promise<string | null> {
  const data = await tmdbFetch<TmdbReleaseDatesResponse>(
    `/movie/${tmdbId}/release_dates`,
  );

  const usEntry = data.results.find((r) => r.iso_3166_1 === 'US');
  if (!usEntry) return null;

  // Prefer Theatrical (type 3), then Theatrical Limited (2), then any with a cert
  const priorityOrder = [3, 2, 1, 4, 5, 6];
  for (const type of priorityOrder) {
    const release = usEntry.release_dates.find(
      (rd) => rd.type === type && rd.certification,
    );
    if (release) return release.certification;
  }

  // Fallback: any release with a certification
  const anyWithCert = usEntry.release_dates.find((rd) => rd.certification);
  return anyWithCert?.certification ?? null;
}

/**
 * Get streaming/watch providers for a movie in a given country.
 */
export async function getWatchProviders(
  tmdbId: number,
  country: string = 'US',
): Promise<TmdbWatchProviderCountry | null> {
  const data = await tmdbFetch<TmdbWatchProvidersResponse>(
    `/movie/${tmdbId}/watch/providers`,
  );

  return data.results[country] ?? null;
}

/**
 * Search movies by title.
 */
export async function searchMovies(
  query: string,
  page: number = 1,
): Promise<TmdbPaginatedResponse<TmdbMovie>> {
  return tmdbFetch<TmdbPaginatedResponse<TmdbMovie>>('/search/movie', {
    query,
    page: String(page),
    include_adult: 'false',
    language: 'en-US',
  });
}

/**
 * Get popular movies.
 */
export async function getPopularMovies(
  page: number = 1,
): Promise<TmdbPaginatedResponse<TmdbMovie>> {
  return tmdbFetch<TmdbPaginatedResponse<TmdbMovie>>('/movie/popular', {
    page: String(page),
    language: 'en-US',
  });
}

/**
 * Get now-playing movies.
 */
export async function getNowPlayingMovies(
  page: number = 1,
): Promise<TmdbPaginatedResponse<TmdbMovie>> {
  return tmdbFetch<TmdbPaginatedResponse<TmdbMovie>>('/movie/now_playing', {
    page: String(page),
    language: 'en-US',
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a URL-friendly slug from title and year.
 * e.g. "The Lion King" + "2019" => "the-lion-king-2019"
 */
export function generateSlug(title: string, year: string): string {
  const base = title
    .toLowerCase()
    .replace(/['']/g, '') // remove apostrophes
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens

  const yearPart = year ? year.slice(0, 4) : '';
  return yearPart ? `${base}-${yearPart}` : base;
}
