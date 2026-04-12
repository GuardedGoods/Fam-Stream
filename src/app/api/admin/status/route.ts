import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { movies, contentRatingsAggregated } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { getLastOmdbFailure } from "@/lib/sync/orchestrator";

/**
 * Admin-only diagnostic endpoint.
 *
 * Returns counts of how far the enrichment pipeline has gotten:
 *   - totalMovies              — total rows in `movies`
 *   - withImdbId               — Phase 2 enrichment succeeded at least partially
 *   - withRtScore              — OMDb call succeeded (RT score populated)
 *   - withMetacriticScore      — OMDb call also yielded Metacritic
 *   - withImdbRating           — OMDb call also yielded IMDb rating
 *   - withContentRating        — Phase 3 scrape populated aggregated row
 *   - envOmdbKeyPresent        — is OMDB_API_KEY set in the container env
 *   - envTmdbKeyPresent        — is TMDB_API_KEY set
 *   - envOpenaiKeyPresent      — is OPENAI_API_KEY set (Phase 4D gate)
 *
 * Protected by admin-email check from `ADMIN_EMAILS` env var. Anyone else
 * gets 401 (not 403) to keep the endpoint's existence quiet.
 */

function parseAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admins = parseAdminEmails();
  if (!admins.has(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const totalRow = db
      .select({ c: sql<number>`count(*)` })
      .from(movies)
      .get();

    const withImdbRow = db
      .select({ c: sql<number>`count(*)` })
      .from(movies)
      .where(sql`${movies.imdbId} IS NOT NULL`)
      .get();

    const withRtRow = db
      .select({ c: sql<number>`count(*)` })
      .from(movies)
      .where(sql`${movies.rottenTomatoesScore} IS NOT NULL`)
      .get();

    const withMetaRow = db
      .select({ c: sql<number>`count(*)` })
      .from(movies)
      .where(sql`${movies.metacriticScore} IS NOT NULL`)
      .get();

    const withImdbRatingRow = db
      .select({ c: sql<number>`count(*)` })
      .from(movies)
      .where(sql`${movies.imdbRating} IS NOT NULL`)
      .get();

    const withContentRow = db
      .select({ c: sql<number>`count(distinct ${contentRatingsAggregated.movieId})` })
      .from(contentRatingsAggregated)
      .get();

    const lastSyncedRow = db
      .select({ ts: sql<string>`max(${movies.lastSyncedAt})` })
      .from(movies)
      .get();

    // Phase 4E: surface the OMDb circuit-breaker state so the dashboard
    // can render a warning band when the pipeline tripped on rate limit
    // or an invalid key. Process-memory — null after a fresh restart
    // until the next Phase 2 run probes OMDb.
    const omdbFailure = getLastOmdbFailure();

    return NextResponse.json({
      totalMovies: totalRow?.c ?? 0,
      withImdbId: withImdbRow?.c ?? 0,
      withRtScore: withRtRow?.c ?? 0,
      withMetacriticScore: withMetaRow?.c ?? 0,
      withImdbRating: withImdbRatingRow?.c ?? 0,
      withContentRating: withContentRow?.c ?? 0,
      envOmdbKeyPresent: Boolean(process.env.OMDB_API_KEY),
      envTmdbKeyPresent: Boolean(process.env.TMDB_API_KEY),
      envOpenaiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
      lastSyncedAt: lastSyncedRow?.ts ?? null,
      omdbStatus: {
        keyPresent: Boolean(process.env.OMDB_API_KEY),
        lastFailureKind: omdbFailure?.kind ?? null,
        lastFailureAt: omdbFailure?.at ?? null,
        lastFailureMessage: omdbFailure?.message ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin/status] query failed:", error);
    return NextResponse.json(
      { error: "Failed to load status", details: message },
      { status: 500 },
    );
  }
}
