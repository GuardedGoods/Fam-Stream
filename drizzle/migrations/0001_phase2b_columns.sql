-- Phase 2B schema additions.
--
-- Non-destructive: every new column is nullable with no default, so existing
-- rows stay intact and reads of the new columns return NULL until the next
-- sync pass populates them.
--
-- The bootstrap migration runner in src/lib/db/index.ts applies each
-- statement via `db.exec(...)` and swallows "duplicate column" errors, so
-- re-running this file on an already-migrated DB is safe.

-- ---------------------------------------------------------------------------
-- movies: richer metadata from TMDB detail responses
-- ---------------------------------------------------------------------------
ALTER TABLE movies ADD COLUMN original_language TEXT;
ALTER TABLE movies ADD COLUMN production_countries TEXT; -- JSON array of ISO-3166 codes
ALTER TABLE movies ADD COLUMN tagline TEXT;
ALTER TABLE movies ADD COLUMN budget INTEGER;
ALTER TABLE movies ADD COLUMN revenue INTEGER;

-- ---------------------------------------------------------------------------
-- content_ratings_aggregated: preserve IMDb's already-scraped per-category
-- severity for alcohol/drugs/smoking and frightening/intense scenes.
-- Scraper pulls these today but collapses them into the 4 main scores —
-- now we keep the extra signal so "Mature Themes" filter has data to filter on.
-- ---------------------------------------------------------------------------
ALTER TABLE content_ratings_aggregated ADD COLUMN alcohol_drugs_score INTEGER; -- 0-5
ALTER TABLE content_ratings_aggregated ADD COLUMN intense_scenes_score INTEGER; -- 0-5
ALTER TABLE content_ratings_aggregated ADD COLUMN alcohol_drugs_notes TEXT;
ALTER TABLE content_ratings_aggregated ADD COLUMN intense_scenes_notes TEXT;

-- ---------------------------------------------------------------------------
-- Indexes to keep the new filters fast
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS movies_original_language_idx ON movies (original_language);
