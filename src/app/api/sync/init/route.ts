import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { movies } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

let syncTriggered = false;
let syncError: string | null = null;

export async function GET() {
  // If a previous sync errored, report it and allow retry
  if (syncError) {
    const error = syncError;
    syncError = null;
    syncTriggered = false;
    return NextResponse.json({ status: "error", error });
  }

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

    // Verify TMDB API key is set
    if (!process.env.TMDB_API_KEY) {
      return NextResponse.json({
        status: "error",
        error: "TMDB_API_KEY is not set. Add it to your .env file.",
      });
    }

    // DB is empty - trigger initial sync in background
    syncTriggered = true;

    const { runSync } = await import("@/lib/sync/orchestrator");
    runSync("movies").catch((err: Error) => {
      console.error("Initial sync error:", err);
      syncError = err.message;
      syncTriggered = false;
    });

    return NextResponse.json({
      status: "sync_started",
      message: "Initial movie sync started. Movies will appear shortly.",
    });
  } catch (error) {
    console.error("Init sync check failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500 }
    );
  }
}
