/**
 * Pure SQL-fragment builders for the new Phase 2B filters. Kept in a
 * dedicated module so they can be unit-tested without spinning up a DB.
 *
 * Everything here returns a Drizzle `SQL` chunk that slots into the
 * `conditions: SQL[]` array consumed by `src/app/api/movies/route.ts`.
 */

import { sql, type SQL } from "drizzle-orm";
import { movies, contentRatingsAggregated } from "@/lib/db/schema";

/**
 * Restrict results to US-market English-language productions.
 *
 * Two-part gate:
 *   - `original_language = 'en'` — filters out foreign-language titles
 *     (which was user-reported: Indian movies showing up in kids' movies).
 *   - `production_countries LIKE '%"US"%'` — movies produced (at least in
 *     part) in the US. Null `production_countries` do NOT pass; that's
 *     intentional — we can't verify origin, so we treat as non-US. Once
 *     the sync has enriched the column for a movie, it becomes visible.
 *
 * Co-productions (e.g. US + UK) pass because the JSON array contains "US".
 */
export function usOnlyCondition(): SQL {
  return sql`(${movies.originalLanguage} = 'en' AND ${movies.productionCountries} LIKE '%"US"%')`;
}

/**
 * `<= maxVal` condition on the mature-themes alcohol/drugs/smoking score.
 * Mirrors the NULL-excludes-unrated behavior of the core 4 sliders.
 */
export function maxAlcoholDrugsCondition(maxVal: number): SQL {
  return sql`${contentRatingsAggregated.alcoholDrugsScore} <= ${maxVal}`;
}

/**
 * `<= maxVal` condition on the mature-themes frightening/intense-scenes score.
 */
export function maxIntenseScenesCondition(maxVal: number): SQL {
  return sql`${contentRatingsAggregated.intenseScenesScore} <= ${maxVal}`;
}
