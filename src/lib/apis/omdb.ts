// ---------------------------------------------------------------------------
// OMDb API Client
// https://www.omdbapi.com/
// ---------------------------------------------------------------------------

const OMDB_BASE_URL = 'https://www.omdbapi.com/';

// ---------------------------------------------------------------------------
// Typed failure for pipeline circuit-breaker use
// ---------------------------------------------------------------------------

/**
 * OMDb returns HTTP 200 + {"Response":"False","Error":"..."} for every
 * error, including rate-limit and invalid-key conditions. The orchestrator
 * needs to distinguish "one movie's worth of trouble" from "the entire
 * OMDb pathway is broken for the rest of this run" — so we throw a typed
 * subclass of Error for the latter.
 *
 * Kinds:
 *   - "rate-limit"  — free tier's 1000/day cap exhausted. Resets at UTC 00:00.
 *   - "invalid-key" — OMDb says the key string is unrecognized.
 *   - "no-key"      — OMDb says no key was supplied.
 */
export type OmdbFailureKind = 'rate-limit' | 'invalid-key' | 'no-key';

export class OmdbRateLimitError extends Error {
  readonly kind: OmdbFailureKind;
  readonly omdbError: string;

  constructor(kind: OmdbFailureKind, omdbError: string) {
    super(`OMDb ${kind}: ${omdbError}`);
    this.name = 'OmdbRateLimitError';
    this.kind = kind;
    this.omdbError = omdbError;
  }
}

/**
 * Classify an OMDb `Error` string. Returns the typed failure kind for
 * pipeline-halting errors, or null for per-movie "not found" cases that
 * should continue the run.
 */
function classifyOmdbError(errorMessage: string | undefined): OmdbFailureKind | null {
  if (!errorMessage) return null;
  // Exact strings per OMDb's current behavior (Dec 2024 — stable for years).
  if (errorMessage === 'Request limit reached!') return 'rate-limit';
  if (errorMessage === 'Invalid API key!') return 'invalid-key';
  if (errorMessage === 'No API key provided.') return 'no-key';
  return null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OmdbRating {
  Source: string;
  Value: string;
}

export interface OmdbMovie {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: OmdbRating[];
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  DVD: string;
  BoxOffice: string;
  Production: string;
  Website: string;
  Response: string;
  Error?: string;
}

export interface OmdbSearchResult {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
}

export interface OmdbSearchResponse {
  Search?: OmdbSearchResult[];
  totalResults?: string;
  Response: string;
  Error?: string;
}

export interface ParsedOmdbMovie {
  title: string;
  year: string;
  rated: string;
  runtime: string;
  genre: string;
  director: string;
  actors: string;
  plot: string;
  poster: string;
  imdbId: string;
  imdbRating: number | null;
  rottenTomatoesScore: number | null;
  metacriticScore: number | null;
  ratings: OmdbRating[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.OMDB_API_KEY;
  if (!key) {
    throw new Error('OMDB_API_KEY environment variable is not set');
  }
  return key;
}

async function omdbFetch(
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const apiKey = getApiKey();
  const url = new URL(OMDB_BASE_URL);
  url.searchParams.set('apikey', apiKey);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `OMDb API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<Record<string, unknown>>;
}

/**
 * Extract the Rotten Tomatoes percentage score from the Ratings array.
 * Returns a number (0-100) or null if not found.
 */
function extractRottenTomatoesScore(ratings: OmdbRating[]): number | null {
  const rt = ratings.find((r) => r.Source === 'Rotten Tomatoes');
  if (!rt) return null;

  // Value is like "85%" – parse the number
  const match = rt.Value.match(/^(\d+)%$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse a numeric string, returning null for non-numeric values like "N/A".
 */
function parseNumeric(value: string): number | null {
  if (!value || value === 'N/A') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Convert raw OMDb response into a cleaner parsed structure.
 */
function parseOmdbMovie(raw: OmdbMovie): ParsedOmdbMovie {
  return {
    title: raw.Title,
    year: raw.Year,
    rated: raw.Rated,
    runtime: raw.Runtime,
    genre: raw.Genre,
    director: raw.Director,
    actors: raw.Actors,
    plot: raw.Plot,
    poster: raw.Poster,
    imdbId: raw.imdbID,
    imdbRating: parseNumeric(raw.imdbRating),
    rottenTomatoesScore: extractRottenTomatoesScore(raw.Ratings ?? []),
    metacriticScore: parseNumeric(raw.Metascore),
    ratings: raw.Ratings ?? [],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch movie data by IMDb ID, including Rotten Tomatoes and Metacritic scores.
 * Returns null if the movie is not found.
 *
 * Throws `OmdbRateLimitError` (subclass of Error) when the failure is
 * pipeline-fatal — quota exhausted, key invalid, or key missing. The
 * orchestrator's circuit breaker catches that class and halts further
 * OMDb calls for the rest of the sync run.
 */
export async function getMovieByImdbId(
  imdbId: string,
): Promise<ParsedOmdbMovie | null> {
  const data = (await omdbFetch({ i: imdbId, plot: 'full' })) as unknown as OmdbMovie;

  if (data.Response === 'False') {
    const kind = classifyOmdbError(data.Error);
    if (kind) {
      throw new OmdbRateLimitError(kind, data.Error ?? '');
    }
    if (data.Error === 'Movie not found!' || data.Error === 'Incorrect IMDb ID.') {
      return null;
    }
    throw new Error(`OMDb API error: ${data.Error}`);
  }

  return parseOmdbMovie(data);
}

/**
 * Search movies by title, optionally filtering by year.
 * Returns an array of search results, or an empty array if nothing is found.
 *
 * Propagates `OmdbRateLimitError` for pipeline-fatal failures for symmetry
 * with `getMovieByImdbId`, in case this is ever called from admin tooling.
 */
export async function searchMovies(
  title: string,
  year?: string,
): Promise<OmdbSearchResult[]> {
  const params: Record<string, string> = {
    s: title,
    type: 'movie',
  };

  if (year) {
    params.y = year;
  }

  const data = (await omdbFetch(params)) as unknown as OmdbSearchResponse;

  if (data.Response === 'False') {
    const kind = classifyOmdbError(data.Error);
    if (kind) {
      throw new OmdbRateLimitError(kind, data.Error ?? '');
    }
    if (data.Error === 'Movie not found!' || data.Error === 'Too many results.') {
      return [];
    }
    throw new Error(`OMDb API error: ${data.Error}`);
  }

  return data.Search ?? [];
}
