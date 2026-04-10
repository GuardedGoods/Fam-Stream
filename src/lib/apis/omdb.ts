// ---------------------------------------------------------------------------
// OMDb API Client
// https://www.omdbapi.com/
// ---------------------------------------------------------------------------

const OMDB_BASE_URL = 'https://www.omdbapi.com/';

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
 */
export async function getMovieByImdbId(
  imdbId: string,
): Promise<ParsedOmdbMovie | null> {
  const data = (await omdbFetch({ i: imdbId, plot: 'full' })) as unknown as OmdbMovie;

  if (data.Response === 'False') {
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
    if (data.Error === 'Movie not found!' || data.Error === 'Too many results.') {
      return [];
    }
    throw new Error(`OMDb API error: ${data.Error}`);
  }

  return data.Search ?? [];
}
