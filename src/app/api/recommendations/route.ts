import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { movies, contentRatingsAggregated } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { getRecommendations } from "@/lib/recommendations/server";
import { eq } from "drizzle-orm";

/**
 * GET /api/recommendations
 *
 * Returns the signed-in user's AI-picked recommendations. Handles all four
 * response shapes from `getRecommendations()`:
 *   - "ok"              — 200 with picks + hydrated movie metadata
 *   - "empty-history"   — 200 with an advisory kind; page renders a
 *                         "mark some films watched first" empty state
 *   - "disabled"        — 200 with disabled kind; page renders a
 *                         configuration note (not a 500)
 *   - "error"           — 500 with details
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getRecommendations(session.user.id);

    if (result.kind === "disabled") {
      return NextResponse.json({ kind: "disabled" });
    }
    if (result.kind === "empty-history") {
      return NextResponse.json({ kind: "empty-history" });
    }
    if (result.kind === "error") {
      return NextResponse.json(
        { kind: "error", error: "Recommendation pipeline failed", details: result.message },
        { status: 500 },
      );
    }

    // Hydrate each pick with the film metadata the detail-page card needs.
    if (result.picks.length === 0) {
      return NextResponse.json({
        kind: "ok",
        picks: [],
        pickedAt: result.pickedAt,
        fromCache: result.fromCache,
      });
    }

    const movieIds = result.picks.map((p) => p.movieId);
    const rows = db
      .select({
        id: movies.id,
        title: movies.title,
        slug: movies.slug,
        posterPath: movies.posterPath,
        releaseDate: movies.releaseDate,
        mpaaRating: movies.mpaaRating,
        imdbRating: movies.imdbRating,
        rottenTomatoesScore: movies.rottenTomatoesScore,
        genres: movies.genres,
        overview: movies.overview,
        languageScore: contentRatingsAggregated.languageScore,
        violenceScore: contentRatingsAggregated.violenceScore,
        sexualContentScore: contentRatingsAggregated.sexualContentScore,
        scaryScore: contentRatingsAggregated.scaryScore,
      })
      .from(movies)
      .leftJoin(
        contentRatingsAggregated,
        eq(movies.id, contentRatingsAggregated.movieId),
      )
      .where(inArray(movies.id, movieIds))
      .all();

    const byId = new Map(rows.map((r) => [r.id, r]));

    // Preserve the AI's ordering
    const hydrated = result.picks
      .map((pick) => {
        const m = byId.get(pick.movieId);
        if (!m) return null;
        let genres: string[] = [];
        try {
          genres = m.genres ? JSON.parse(m.genres) : [];
        } catch {
          /* ignore */
        }
        return {
          id: m.id,
          title: m.title,
          slug: m.slug,
          posterPath: m.posterPath,
          year: m.releaseDate?.slice(0, 4) ?? null,
          mpaaRating: m.mpaaRating,
          imdbRating: m.imdbRating,
          rottenTomatoesScore: m.rottenTomatoesScore,
          genres,
          overview: m.overview,
          contentScores: {
            language: m.languageScore,
            violence: m.violenceScore,
            sexual: m.sexualContentScore,
            scary: m.scaryScore,
          },
          reason: pick.reason,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return NextResponse.json({
      kind: "ok",
      picks: hydrated,
      pickedAt: result.pickedAt,
      fromCache: result.fromCache,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[recommendations:GET] failed:", error);
    return NextResponse.json(
      { kind: "error", error: "Failed to fetch recommendations", details: message },
      { status: 500 },
    );
  }
}
