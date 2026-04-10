import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { movies } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

let syncTriggered = false;

export async function GET() {
  // Only allow one auto-sync per server lifetime
  if (syncTriggered) {
    return NextResponse.json({ status: "already_triggered" });
  }

  try {
    // Check if movies table has any data
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(movies)
      .get();

    const movieCount = result?.count || 0;

    if (movieCount > 0) {
      return NextResponse.json({ status: "has_data", count: movieCount });
    }

    // DB is empty - trigger initial sync in background
    syncTriggered = true;

    const { runSync } = await import("@/lib/sync/orchestrator");
    runSync("movies").catch((err: Error) => {
      console.error("Initial sync error:", err);
      syncTriggered = false; // Allow retry on failure
    });

    return NextResponse.json({
      status: "sync_started",
      message: "Initial movie sync started. Movies will appear shortly.",
    });
  } catch (error) {
    console.error("Init sync check failed:", error);
    return NextResponse.json(
      { status: "error", error: "Failed to check database" },
      { status: 500 }
    );
  }
}
