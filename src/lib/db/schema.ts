import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Movies – core movie data from TMDB + OMDb
// ---------------------------------------------------------------------------
export const movies = sqliteTable(
  'movies',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tmdbId: integer('tmdb_id').notNull(),
    imdbId: text('imdb_id'),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    overview: text('overview'),
    releaseDate: text('release_date'),
    runtimeMinutes: integer('runtime_minutes'),
    posterPath: text('poster_path'),
    backdropPath: text('backdrop_path'),
    mpaaRating: text('mpaa_rating'),
    imdbRating: real('imdb_rating'),
    rottenTomatoesScore: integer('rotten_tomatoes_score'),
    metacriticScore: integer('metacritic_score'),
    popularity: real('popularity'),
    genres: text('genres'), // JSON array of genre names
    aiSummary: text('ai_summary'),
    /** ISO 639-1 language code of original production, e.g. "en", "hi", "ko". */
    originalLanguage: text('original_language'),
    /** JSON array of ISO 3166-1 country codes, e.g. ["US"], ["US","GB"]. */
    productionCountries: text('production_countries'),
    tagline: text('tagline'),
    budget: integer('budget'),
    revenue: integer('revenue'),
    lastSyncedAt: text('last_synced_at'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('movies_tmdb_id_idx').on(table.tmdbId),
    uniqueIndex('movies_slug_idx').on(table.slug),
  ],
);

// ---------------------------------------------------------------------------
// Content Ratings – scraped content advisory data per source
// ---------------------------------------------------------------------------
export const contentRatings = sqliteTable(
  'content_ratings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    source: text('source').notNull(), // 'kids-in-mind' | 'common-sense-media' | 'imdb' | 'dove' | 'manual' | 'ai-estimated'
    languageScore: integer('language_score'),
    violenceScore: integer('violence_score'),
    sexualContentScore: integer('sexual_content_score'),
    scaryScore: integer('scary_score'),
    languageNotes: text('language_notes'),
    violenceNotes: text('violence_notes'),
    sexualNotes: text('sexual_notes'),
    scaryNotes: text('scary_notes'),
    profanityWords: text('profanity_words'), // JSON like {"f-word": 3, "damn": 5}
    recommendedAge: integer('recommended_age'),
    sourceUrl: text('source_url'),
    scrapedAt: text('scraped_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('content_ratings_movie_source_idx').on(
      table.movieId,
      table.source,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Content Ratings Aggregated – normalized scores for filtering
// ---------------------------------------------------------------------------
export const contentRatingsAggregated = sqliteTable(
  'content_ratings_aggregated',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    languageScore: integer('language_score'), // 0-5 normalized
    violenceScore: integer('violence_score'), // 0-5 normalized
    sexualContentScore: integer('sexual_content_score'), // 0-5 normalized
    scaryScore: integer('scary_score'), // 0-5 normalized
    /**
     * Mature-themes dimensions — extracted from the IMDb Parental Guide
     * scraper (alcohol/drugs/smoking, frightening/intense scenes). The
     * scraper already pulled these per-category severity labels; we now
     * persist the 0-5 normalized values so users can filter on them.
     */
    alcoholDrugsScore: integer('alcohol_drugs_score'), // 0-5 normalized
    intenseScenesScore: integer('intense_scenes_score'), // 0-5 normalized
    languageNotes: text('language_notes'),
    violenceNotes: text('violence_notes'),
    sexualNotes: text('sexual_notes'),
    scaryNotes: text('scary_notes'),
    alcoholDrugsNotes: text('alcohol_drugs_notes'),
    intenseScenesNotes: text('intense_scenes_notes'),
    specificWords: text('specific_words'), // JSON array of specific words found
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('content_ratings_agg_movie_idx').on(table.movieId),
  ],
);

// ---------------------------------------------------------------------------
// Streaming Providers – known streaming services
// ---------------------------------------------------------------------------
export const streamingProviders = sqliteTable(
  'streaming_providers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tmdbProviderId: integer('tmdb_provider_id').notNull(),
    name: text('name').notNull(),
    logoPath: text('logo_path'),
    displayPriority: integer('display_priority').default(999),
  },
  (table) => [
    uniqueIndex('streaming_providers_tmdb_id_idx').on(table.tmdbProviderId),
  ],
);

// ---------------------------------------------------------------------------
// Movie Cast & Crew — top-N cast + director/writers per movie
// Populated from TMDB /movie/{id}/credits in Phase 2 enrichment.
// ---------------------------------------------------------------------------
export const movieCast = sqliteTable(
  "movie_cast",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    tmdbPersonId: integer("tmdb_person_id").notNull(),
    name: text("name").notNull(),
    /** Character name for cast members; empty for crew. */
    character: text("character"),
    profilePath: text("profile_path"),
    /** 0-based cast billing order (0 = lead). Nullable for crew. */
    castOrder: integer("cast_order"),
    /** 1 for crew rows (director, writers), 0 for cast. */
    isCrew: integer("is_crew").default(0),
    /** Crew job label ("Director", "Writer", "Screenplay"). Nullable for cast. */
    crewJob: text("crew_job"),
  },
  (table) => [
    uniqueIndex("movie_cast_unique_idx").on(
      table.movieId,
      table.tmdbPersonId,
      table.crewJob,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Movie Providers – junction: which movies are on which services
// ---------------------------------------------------------------------------
export const movieProviders = sqliteTable(
  'movie_providers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    providerId: integer('provider_id')
      .notNull()
      .references(() => streamingProviders.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'flatrate' | 'rent' | 'buy'
    link: text('link'),
    country: text('country').default('US'),
    lastCheckedAt: text('last_checked_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('movie_providers_unique_idx').on(
      table.movieId,
      table.providerId,
      table.type,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Users – Auth.js managed
// ---------------------------------------------------------------------------
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email'),
  emailVerified: integer('email_verified'), // timestamp
  image: text('image'),
}, (table) => [
  uniqueIndex('users_email_idx').on(table.email),
]);

// ---------------------------------------------------------------------------
// Accounts – Auth.js OAuth
// ---------------------------------------------------------------------------
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
});

// ---------------------------------------------------------------------------
// Sessions – Auth.js sessions
// ---------------------------------------------------------------------------
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  sessionToken: text('session_token').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires').notNull(),
}, (table) => [
  uniqueIndex('sessions_token_idx').on(table.sessionToken),
]);

// ---------------------------------------------------------------------------
// Verification Tokens – Auth.js
// ---------------------------------------------------------------------------
export const verificationTokens = sqliteTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: integer('expires').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
    uniqueIndex('verification_tokens_token_idx').on(table.token),
  ],
);

// ---------------------------------------------------------------------------
// User Movies – Watchlist / watched / skipped
// ---------------------------------------------------------------------------
export const userMovies = sqliteTable(
  'user_movies',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    status: text('status').notNull(), // 'watchlist' | 'watched' | 'skipped'
    rating: integer('rating'), // 1-5
    notes: text('notes'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('user_movies_unique_idx').on(table.userId, table.movieId),
  ],
);

// ---------------------------------------------------------------------------
// User Streaming Services – which services a user subscribes to
// ---------------------------------------------------------------------------
export const userStreamingServices = sqliteTable(
  'user_streaming_services',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: integer('provider_id')
      .notNull()
      .references(() => streamingProviders.id, { onDelete: 'cascade' }),
    active: integer('active').default(1), // boolean
  },
  (table) => [
    uniqueIndex('user_streaming_unique_idx').on(table.userId, table.providerId),
  ],
);

// ---------------------------------------------------------------------------
// Blocked Words – words a user wants to filter out
// ---------------------------------------------------------------------------
export const blockedWords = sqliteTable('blocked_words', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  word: text('word').notNull(),
});

// ---------------------------------------------------------------------------
// Recommendation Cache — AI-picked movies per user, refreshed every 24h.
// Phase 4D populates this via the OpenAI client; the `/recommendations`
// page serves from here to keep response latency + cost low.
// ---------------------------------------------------------------------------
export const recommendationCache = sqliteTable("recommendation_cache", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** JSON: [{ movieId, reason: string }, ...]. Shape validated on read. */
  picksJson: text("picks_json").notNull(),
  pickedAt: text("picked_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// ---------------------------------------------------------------------------
// User Filter Profiles – per-user filter preferences
// ---------------------------------------------------------------------------
export const userFilterProfiles = sqliteTable('user_filter_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // e.g. "Family Movie Night"
  maxLanguageScore: integer('max_language_score').default(2),
  maxViolenceScore: integer('max_violence_score').default(3),
  maxSexualContentScore: integer('max_sexual_content_score').default(1),
  maxScaryScore: integer('max_scary_score').default(3),
  maxMpaa: text('max_mpaa').default('PG'),
  isActive: integer('is_active').default(1),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// ===========================================================================
// Relations
// ===========================================================================

export const moviesRelations = relations(movies, ({ many, one }) => ({
  contentRatings: many(contentRatings),
  aggregatedRating: one(contentRatingsAggregated),
  movieProviders: many(movieProviders),
  userMovies: many(userMovies),
}));

export const contentRatingsRelations = relations(contentRatings, ({ one }) => ({
  movie: one(movies, {
    fields: [contentRatings.movieId],
    references: [movies.id],
  }),
}));

export const contentRatingsAggregatedRelations = relations(
  contentRatingsAggregated,
  ({ one }) => ({
    movie: one(movies, {
      fields: [contentRatingsAggregated.movieId],
      references: [movies.id],
    }),
  }),
);

export const streamingProvidersRelations = relations(
  streamingProviders,
  ({ many }) => ({
    movieProviders: many(movieProviders),
    userStreamingServices: many(userStreamingServices),
  }),
);

export const movieProvidersRelations = relations(movieProviders, ({ one }) => ({
  movie: one(movies, {
    fields: [movieProviders.movieId],
    references: [movies.id],
  }),
  provider: one(streamingProviders, {
    fields: [movieProviders.providerId],
    references: [streamingProviders.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  userMovies: many(userMovies),
  userStreamingServices: many(userStreamingServices),
  blockedWords: many(blockedWords),
  filterProfiles: many(userFilterProfiles),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const userMoviesRelations = relations(userMovies, ({ one }) => ({
  user: one(users, {
    fields: [userMovies.userId],
    references: [users.id],
  }),
  movie: one(movies, {
    fields: [userMovies.movieId],
    references: [movies.id],
  }),
}));

export const userStreamingServicesRelations = relations(
  userStreamingServices,
  ({ one }) => ({
    user: one(users, {
      fields: [userStreamingServices.userId],
      references: [users.id],
    }),
    provider: one(streamingProviders, {
      fields: [userStreamingServices.providerId],
      references: [streamingProviders.id],
    }),
  }),
);

export const blockedWordsRelations = relations(blockedWords, ({ one }) => ({
  user: one(users, {
    fields: [blockedWords.userId],
    references: [users.id],
  }),
}));

export const userFilterProfilesRelations = relations(
  userFilterProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [userFilterProfiles.userId],
      references: [users.id],
    }),
  }),
);
