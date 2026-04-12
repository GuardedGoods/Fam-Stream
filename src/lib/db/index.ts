import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

let _db: BetterSQLite3Database<typeof schema> | null = null;

function getDbPath(): string {
  return (
    process.env.DATABASE_URL?.replace("file:", "") ||
    path.join(process.cwd(), "data", "movienight.db")
  );
}

function createTables(sqlite: InstanceType<typeof Database>): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER UNIQUE NOT NULL,
      imdb_id TEXT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      overview TEXT,
      release_date TEXT,
      runtime_minutes INTEGER,
      poster_path TEXT,
      backdrop_path TEXT,
      mpaa_rating TEXT,
      imdb_rating REAL,
      rotten_tomatoes_score INTEGER,
      metacritic_score INTEGER,
      popularity REAL,
      genres TEXT,
      ai_summary TEXT,
      original_language TEXT,
      production_countries TEXT,
      tagline TEXT,
      budget INTEGER,
      revenue INTEGER,
      last_synced_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS content_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_id INTEGER NOT NULL REFERENCES movies(id),
      source TEXT NOT NULL,
      language_score INTEGER,
      violence_score INTEGER,
      sexual_content_score INTEGER,
      scary_score INTEGER,
      language_notes TEXT,
      violence_notes TEXT,
      sexual_notes TEXT,
      scary_notes TEXT,
      profanity_words TEXT,
      recommended_age INTEGER,
      source_url TEXT,
      scraped_at TEXT DEFAULT (datetime('now')),
      UNIQUE(movie_id, source)
    );

    CREATE TABLE IF NOT EXISTS content_ratings_aggregated (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_id INTEGER UNIQUE NOT NULL REFERENCES movies(id),
      language_score INTEGER,
      violence_score INTEGER,
      sexual_content_score INTEGER,
      scary_score INTEGER,
      alcohol_drugs_score INTEGER,
      intense_scenes_score INTEGER,
      language_notes TEXT,
      violence_notes TEXT,
      sexual_notes TEXT,
      scary_notes TEXT,
      alcohol_drugs_notes TEXT,
      intense_scenes_notes TEXT,
      specific_words TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS streaming_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_provider_id INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      logo_path TEXT,
      display_priority INTEGER DEFAULT 999
    );

    CREATE TABLE IF NOT EXISTS movie_cast (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_id INTEGER NOT NULL REFERENCES movies(id),
      tmdb_person_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      character TEXT,
      profile_path TEXT,
      cast_order INTEGER,
      is_crew INTEGER DEFAULT 0,
      crew_job TEXT,
      UNIQUE(movie_id, tmdb_person_id, crew_job)
    );

    CREATE TABLE IF NOT EXISTS movie_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_id INTEGER NOT NULL REFERENCES movies(id),
      provider_id INTEGER NOT NULL REFERENCES streaming_providers(id),
      type TEXT NOT NULL,
      link TEXT,
      country TEXT DEFAULT 'US',
      last_checked_at TEXT DEFAULT (datetime('now')),
      UNIQUE(movie_id, provider_id, type)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      email_verified INTEGER,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      session_token TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      expires INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires INTEGER NOT NULL,
      PRIMARY KEY (identifier, token)
    );

    CREATE TABLE IF NOT EXISTS user_movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      movie_id INTEGER NOT NULL REFERENCES movies(id),
      status TEXT NOT NULL,
      rating INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, movie_id)
    );

    CREATE TABLE IF NOT EXISTS user_streaming_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      provider_id INTEGER NOT NULL REFERENCES streaming_providers(id),
      active INTEGER DEFAULT 1,
      UNIQUE(user_id, provider_id)
    );

    CREATE TABLE IF NOT EXISTS blocked_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      word TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recommendation_cache (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      picks_json TEXT NOT NULL,
      picked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_filter_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      max_language_score INTEGER DEFAULT 2,
      max_violence_score INTEGER DEFAULT 3,
      max_sexual_content_score INTEGER DEFAULT 1,
      max_scary_score INTEGER DEFAULT 3,
      max_mpaa TEXT DEFAULT 'PG',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Apply idempotent ALTER TABLE migrations for columns added after the
 * initial schema shipped. Each statement is run in isolation and the
 * "duplicate column" error is swallowed, so the migrations are safe to
 * re-run on every boot. This is lightweight vs. a full drizzle-kit setup
 * and matches the project's existing "tables created at startup" pattern.
 *
 * Any new ALTER TABLE for future phases should be appended here.
 */
function runMigrations(sqlite: InstanceType<typeof Database>): void {
  const statements: string[] = [
    // Phase 2B — movies metadata from TMDB detail responses
    `ALTER TABLE movies ADD COLUMN original_language TEXT`,
    `ALTER TABLE movies ADD COLUMN production_countries TEXT`,
    `ALTER TABLE movies ADD COLUMN tagline TEXT`,
    `ALTER TABLE movies ADD COLUMN budget INTEGER`,
    `ALTER TABLE movies ADD COLUMN revenue INTEGER`,
    // Phase 2B — mature-themes severity columns
    `ALTER TABLE content_ratings_aggregated ADD COLUMN alcohol_drugs_score INTEGER`,
    `ALTER TABLE content_ratings_aggregated ADD COLUMN intense_scenes_score INTEGER`,
    `ALTER TABLE content_ratings_aggregated ADD COLUMN alcohol_drugs_notes TEXT`,
    `ALTER TABLE content_ratings_aggregated ADD COLUMN intense_scenes_notes TEXT`,
    // Index to keep the US-only filter fast
    `CREATE INDEX IF NOT EXISTS movies_original_language_idx ON movies (original_language)`,
    // Phase 4C — movie_cast table. Create if missing (for DBs that
    // predate the addition). Plus index on (movie_id, cast_order) so the
    // detail-page query is cheap.
    `CREATE TABLE IF NOT EXISTS movie_cast (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_id INTEGER NOT NULL REFERENCES movies(id),
      tmdb_person_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      character TEXT,
      profile_path TEXT,
      cast_order INTEGER,
      is_crew INTEGER DEFAULT 0,
      crew_job TEXT,
      UNIQUE(movie_id, tmdb_person_id, crew_job)
    )`,
    `CREATE INDEX IF NOT EXISTS movie_cast_movie_idx ON movie_cast (movie_id, cast_order)`,
    // Phase 4D — AI recommendation cache table (per-user).
    `CREATE TABLE IF NOT EXISTS recommendation_cache (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      picks_json TEXT NOT NULL,
      picked_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ];

  for (const sql of statements) {
    try {
      sqlite.exec(sql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Expected on re-run: column already present. Anything else is a bug.
      if (!/duplicate column name/i.test(msg)) {
        console.error(`[db migrations] ${sql} failed:`, err);
      }
    }
  }
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!_db) {
    const dbPath = getDbPath();

    // Ensure data directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");

    // Create tables if they don't exist (fresh install path), then apply
    // any additive migrations (existing install path). Both idempotent.
    createTables(sqlite);
    runMigrations(sqlite);

    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

// For convenience
export const db = getDb();

export type DB = BetterSQLite3Database<typeof schema>;
