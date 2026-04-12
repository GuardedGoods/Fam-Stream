import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userFilterProfiles, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";

/**
 * GET/PUT the signed-in user's default filter profile.
 *
 * The `userFilterProfiles` table has always existed but there was no PUT
 * route to write to it, so Settings' sliders were effectively read-only.
 * Now the Settings save button hits PUT here, and the browse page reads
 * via GET /api/user/filter-defaults (which batches this together with
 * the user's streaming services).
 *
 * One "active" row per user. If no row exists yet, PUT creates one named
 * "default" with `isActive = 1`.
 */

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const row = db
      .select()
      .from(userFilterProfiles)
      .where(
        and(
          eq(userFilterProfiles.userId, session.user.id),
          eq(userFilterProfiles.isActive, 1),
        ),
      )
      .get();

    return NextResponse.json({ profile: row ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[filter-profile:GET] failed:", error);
    return NextResponse.json(
      { error: "Failed to load filter profile", details: message },
      { status: 500 },
    );
  }
}

/**
 * Defensive users-row upsert — same pattern as the watchlist route. Needed
 * because `userFilterProfiles.userId` is FK to `users`, and JWT-strategy
 * edge cases can leave session.user.id orphaned until we force-populate.
 */
function ensureUserRow(session: {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  };
}): void {
  const id = session.user?.id;
  if (!id) return;
  db.insert(users)
    .values({
      id,
      email: session.user?.email ?? null,
      name: session.user?.name ?? null,
      image: session.user?.image ?? null,
    })
    .onConflictDoNothing()
    .run();
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      maxLanguageScore?: number;
      maxViolenceScore?: number;
      maxSexualContentScore?: number;
      maxScaryScore?: number;
      maxMpaa?: string;
    };

    ensureUserRow(session);

    const existing = db
      .select({ id: userFilterProfiles.id })
      .from(userFilterProfiles)
      .where(
        and(
          eq(userFilterProfiles.userId, session.user.id),
          eq(userFilterProfiles.isActive, 1),
        ),
      )
      .get();

    const payload = {
      maxLanguageScore: body.maxLanguageScore ?? 2,
      maxViolenceScore: body.maxViolenceScore ?? 3,
      maxSexualContentScore: body.maxSexualContentScore ?? 1,
      maxScaryScore: body.maxScaryScore ?? 3,
      maxMpaa: body.maxMpaa ?? "PG",
    };

    if (existing) {
      db.update(userFilterProfiles)
        .set(payload)
        .where(eq(userFilterProfiles.id, existing.id))
        .run();
    } else {
      db.insert(userFilterProfiles)
        .values({
          userId: session.user.id,
          name: "default",
          isActive: 1,
          ...payload,
        })
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[filter-profile:PUT] failed:", error);
    return NextResponse.json(
      { error: "Failed to save filter profile", details: message },
      { status: 500 },
    );
  }
}
