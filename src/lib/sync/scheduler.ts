import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { movies } from "@/lib/db/schema";
import { runSync } from "./orchestrator";

let initialized = false;

/**
 * Cold-start sync trigger: if the movies table has fewer than this many rows
 * when the server boots, kick an immediate "movies" sync so a fresh install
 * populates without waiting for the 3 AM cron.
 */
const COLD_START_THRESHOLD = 10;

/** Wrap a sync call so a throw can never kill node-cron's timer thread. */
function safeRun(label: string, type: "movies" | "content" | "streaming") {
  console.log(`[scheduler] Running ${label}...`);
  runSync(type).catch((err) => {
    console.error(`[scheduler] ${label} failed:`, err);
  });
}

function maybeColdStart() {
  try {
    const row = db
      .select({ count: sql<number>`count(*)` })
      .from(movies)
      .get();
    const count = row?.count ?? 0;
    if (count < COLD_START_THRESHOLD) {
      console.log(
        `[scheduler] Only ${count} movies in DB — running cold-start sync.`,
      );
      safeRun("cold-start movie sync", "movies");
    }
  } catch (err) {
    // DB might not be ready on first boot; don't block scheduler init.
    console.error("[scheduler] Cold-start check failed:", err);
  }
}

export function initScheduler() {
  if (initialized) {
    console.log("[scheduler] already initialized, skipping.");
    return;
  }
  initialized = true;

  console.log("[scheduler] Initializing sync scheduler...");

  // Daily at 3 AM — sync new movies from TMDB
  cron.schedule("0 3 * * *", () => safeRun("daily movie sync", "movies"));

  // Daily at 5 AM — scrape content ratings for unrated movies
  cron.schedule("0 5 * * *", () =>
    safeRun("daily content rating scrape", "content"),
  );

  // Every 3 days at 6 AM — refresh streaming availability
  cron.schedule("0 6 */3 * *", () =>
    safeRun("streaming availability refresh", "streaming"),
  );

  console.log("[scheduler] schedules registered:");
  console.log("  - Movie sync: Daily at 3:00 AM");
  console.log("  - Content scrape: Daily at 5:00 AM");
  console.log("  - Streaming refresh: Every 3 days at 6:00 AM");

  maybeColdStart();
}

/**
 * Reset the module-level guard. Intended for tests only.
 */
export function __resetSchedulerForTests() {
  initialized = false;
}
