import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  userFilterProfiles,
  userStreamingServices,
  streamingProviders,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";

/**
 * One-shot bundle of the signed-in user's default filter preferences,
 * consumed by the Browse page on mount when no filter URL params are
 * present. Combines two tables into a single round-trip:
 *
 *   - `userFilterProfiles` (active row) — content thresholds
 *   - `userStreamingServices` (active rows) + join `streamingProviders`
 *     to resolve the TMDB provider IDs the filter panel expects
 *
 * Returns null-safe defaults: a user who's never visited Settings gets
 * `{ serviceProviderIds: [], profile: null }` and the Browse page falls
 * back to its existing anonymous defaults.
 */

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { serviceProviderIds: [], profile: null },
      { status: 200 },
    );
  }

  try {
    // Active filter profile (or null)
    const profile = db
      .select()
      .from(userFilterProfiles)
      .where(
        and(
          eq(userFilterProfiles.userId, session.user.id),
          eq(userFilterProfiles.isActive, 1),
        ),
      )
      .get();

    // Subscribed services — join to get the internal streamingProviders.id
    // the filter panel toggles are keyed on.
    const subscribed = db
      .select({ providerId: streamingProviders.id })
      .from(userStreamingServices)
      .innerJoin(
        streamingProviders,
        eq(userStreamingServices.providerId, streamingProviders.id),
      )
      .where(
        and(
          eq(userStreamingServices.userId, session.user.id),
          eq(userStreamingServices.active, 1),
        ),
      )
      .all();

    return NextResponse.json({
      serviceProviderIds: subscribed.map((r) => r.providerId),
      profile: profile ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[filter-defaults:GET] failed:", error);
    return NextResponse.json(
      { error: "Failed to load filter defaults", details: message },
      { status: 500 },
    );
  }
}
