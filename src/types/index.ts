// Movie with all related data for display
export interface MovieWithDetails {
  id: number;
  tmdbId: number;
  imdbId: string | null;
  title: string;
  slug: string;
  overview: string | null;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  mpaaRating: string | null;
  imdbRating: number | null;
  rottenTomatoesScore: number | null;
  metacriticScore: number | null;
  popularity: number | null;
  genres: string[];
  aiSummary: string | null;
  contentRating: AggregatedContentRating | null;
  contentSources: ContentRatingSource[];
  streamingProviders: StreamingProviderInfo[];
  userStatus?: UserMovieStatus | null;
}

export interface AggregatedContentRating {
  languageScore: number;
  violenceScore: number;
  sexualContentScore: number;
  scaryScore: number;
  alcoholDrugsScore?: number | null;
  intenseScenesScore?: number | null;
  languageNotes: string | null;
  violenceNotes: string | null;
  sexualNotes: string | null;
  scaryNotes: string | null;
  alcoholDrugsNotes?: string | null;
  intenseScenesNotes?: string | null;
  specificWords: string[];
}

export interface ContentRatingSource {
  source: string;
  languageScore: number | null;
  violenceScore: number | null;
  sexualContentScore: number | null;
  scaryScore: number | null;
  languageNotes: string | null;
  violenceNotes: string | null;
  sexualNotes: string | null;
  scaryNotes: string | null;
  profanityWords: Record<string, number>;
  recommendedAge: number | null;
  sourceUrl: string | null;
}

export interface StreamingProviderInfo {
  id: number;
  name: string;
  logoPath: string | null;
  type: 'flatrate' | 'rent' | 'buy';
  link: string | null;
}

export interface UserMovieStatus {
  status: 'watchlist' | 'watched' | 'skipped';
  rating: number | null;
  notes: string | null;
}

export interface MovieFilters {
  search?: string;
  genres?: string[];
  mpaaRatings?: string[];
  maxLanguageScore?: number;
  maxViolenceScore?: number;
  maxSexualContentScore?: number;
  maxScaryScore?: number;
  /** Mature-themes: max acceptable alcohol/drugs/smoking severity (0-5). */
  maxAlcoholDrugsScore?: number;
  /** Mature-themes: max acceptable frightening/intense-scenes severity (0-5). */
  maxIntenseScenesScore?: number;
  streamingServices?: number[];
  minYear?: number;
  maxYear?: number;
  hideWatched?: boolean;
  hideUnrated?: boolean;
  /** When true: only return US-market / English-language productions. */
  usOnly?: boolean;
  blockedWords?: string[];
  sort?: 'popularity' | 'release_date' | 'title' | 'imdb_rating' | 'rt_score';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface FilterProfile {
  id: number;
  name: string;
  maxLanguageScore: number;
  maxViolenceScore: number;
  maxSexualContentScore: number;
  maxScaryScore: number;
  maxMpaa: string;
  isActive: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Content score verdict
export type ContentVerdict = 'pass' | 'caution' | 'blocked' | 'unrated';

export interface MovieVerdict {
  verdict: ContentVerdict;
  reasons: string[];
}
