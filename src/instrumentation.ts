/**
 * Next.js App Router instrumentation entry point.
 *
 * `register()` runs once when a new Next.js server instance is initiated.
 * We use it to start the cron scheduler (daily movie sync, content scrape,
 * streaming refresh) and kick a cold-start bootstrap when the DB is empty.
 *
 * Docs: app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  // node-cron and better-sqlite3 only work on the Node.js runtime. Skip the
  // Edge runtime (used for the proxy layer).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Dynamic import keeps server-only modules out of the Edge bundle.
  const { initScheduler } = await import("./lib/sync/scheduler");
  initScheduler();
}
