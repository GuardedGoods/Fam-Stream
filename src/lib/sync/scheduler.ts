import cron from "node-cron";
import { runSync } from "./orchestrator";

let initialized = false;

export function initScheduler() {
  if (initialized) return;
  initialized = true;

  console.log("Initializing sync scheduler...");

  // Daily at 3 AM - sync new movies from TMDB
  cron.schedule("0 3 * * *", () => {
    console.log("Running daily movie sync...");
    runSync("movies").catch((err) => {
      console.error("Daily movie sync failed:", err);
    });
  });

  // Daily at 5 AM - scrape content ratings for unrated movies
  cron.schedule("0 5 * * *", () => {
    console.log("Running daily content rating scrape...");
    runSync("content").catch((err) => {
      console.error("Daily content scrape failed:", err);
    });
  });

  // Every 3 days at 6 AM - refresh streaming availability
  cron.schedule("0 6 */3 * *", () => {
    console.log("Running streaming availability refresh...");
    runSync("streaming").catch((err) => {
      console.error("Streaming refresh failed:", err);
    });
  });

  console.log("Sync scheduler initialized with schedules:");
  console.log("  - Movie sync: Daily at 3:00 AM");
  console.log("  - Content scrape: Daily at 5:00 AM");
  console.log("  - Streaming refresh: Every 3 days at 6:00 AM");
}
