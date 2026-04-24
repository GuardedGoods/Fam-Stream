import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  streamingProviders,
  userStreamingServices,
  userFilterProfiles,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { validateIdArray } from "@/lib/validation";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allProviders = db.select().from(streamingProviders).all();

    const userServices = db
      .select()
      .from(userStreamingServices)
      .where(eq(userStreamingServices.userId, session.user.id))
      .all();

    const activeIds = new Set(
      userServices.filter((s) => s.active).map((s) => s.providerId)
    );

    const services = allProviders.map((p) => ({
      id: p.id,
      name: p.name,
      logoPath: p.logoPath,
      active: activeIds.has(p.id),
    }));

    // Get active filter profile
    const filterProfile = db
      .select()
      .from(userFilterProfiles)
      .where(
        and(
          eq(userFilterProfiles.userId, session.user.id),
          eq(userFilterProfiles.isActive, 1)
        )
      )
      .get();

    return NextResponse.json({ services, filterProfile: filterProfile || null });
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { services: activeServiceIds } = await request.json();

    if (activeServiceIds != null && validateIdArray(activeServiceIds) === null) {
      return NextResponse.json(
        { error: "services must be an array of positive integers" },
        { status: 400 },
      );
    }

    // Remove all existing
    db.delete(userStreamingServices)
      .where(eq(userStreamingServices.userId, session.user.id))
      .run();

    // Insert active ones
    if (activeServiceIds && activeServiceIds.length > 0) {
      for (const providerId of activeServiceIds) {
        db.insert(userStreamingServices)
          .values({
            userId: session.user.id,
            providerId,
            active: 1,
          })
          .run();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update services:", error);
    return NextResponse.json(
      { error: "Failed to update services" },
      { status: 500 }
    );
  }
}
