import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Pins the cron scheduler wiring. The original bug was that `initScheduler()`
 * was orphaned — never imported. The fix is `src/instrumentation.ts`. These
 * tests assert:
 *  - `initScheduler()` registers three cron entries with the expected times
 *  - a second call is idempotent (no duplicate schedules)
 *  - cold-start runs `runSync("movies")` when the DB is nearly empty
 *  - cold-start does NOT run when the DB is populated
 *  - a throw from runSync doesn't propagate out of the scheduled callback
 */

const scheduleSpy = vi.fn();
vi.mock("node-cron", () => ({
  default: { schedule: (...args: unknown[]) => scheduleSpy(...args) },
}));

// Count movies mock — driven per-test.
const countResult = { value: 0 };
vi.mock("@/lib/db", () => {
  const chain = {
    from: () => chain,
    get: () => ({ count: countResult.value }),
  };
  return {
    db: {
      select: () => chain,
    },
  };
});

vi.mock("@/lib/db/schema", () => ({ movies: {} }));

const runSyncSpy = vi.fn();
vi.mock("../orchestrator", () => ({
  runSync: (type: string) => runSyncSpy(type),
}));

async function loadScheduler() {
  vi.resetModules();
  scheduleSpy.mockClear();
  runSyncSpy.mockReset();
  runSyncSpy.mockResolvedValue(undefined);
  const mod = await import("../scheduler");
  return mod;
}

describe("initScheduler", () => {
  beforeEach(() => {
    countResult.value = 0;
  });

  it("registers three cron schedules with the expected cron expressions", async () => {
    countResult.value = 1000; // skip cold-start
    const { initScheduler } = await loadScheduler();
    initScheduler();

    expect(scheduleSpy).toHaveBeenCalledTimes(3);
    const exprs = scheduleSpy.mock.calls.map((c) => c[0]);
    expect(exprs).toContain("0 3 * * *"); // daily movies at 3 AM
    expect(exprs).toContain("0 5 * * *"); // daily content at 5 AM
    expect(exprs).toContain("0 6 */3 * *"); // streaming every 3 days at 6 AM
  });

  it("is idempotent across repeat calls", async () => {
    countResult.value = 1000;
    const { initScheduler, __resetSchedulerForTests } = await loadScheduler();
    initScheduler();
    initScheduler();
    initScheduler();
    expect(scheduleSpy).toHaveBeenCalledTimes(3);
    __resetSchedulerForTests();
  });

  it("kicks a cold-start movie sync when DB has fewer than 10 movies", async () => {
    countResult.value = 2;
    const { initScheduler } = await loadScheduler();
    initScheduler();
    expect(runSyncSpy).toHaveBeenCalledWith("movies");
  });

  it("skips cold-start when DB is already populated", async () => {
    countResult.value = 500;
    const { initScheduler } = await loadScheduler();
    initScheduler();
    expect(runSyncSpy).not.toHaveBeenCalled();
  });

  it("swallows errors from scheduled jobs so cron keeps running", async () => {
    countResult.value = 1000;
    runSyncSpy.mockImplementation(() => Promise.reject(new Error("boom")));
    const { initScheduler } = await loadScheduler();
    initScheduler();

    // Grab the 3AM movie-sync callback and invoke it.
    const call = scheduleSpy.mock.calls.find((c) => c[0] === "0 3 * * *");
    expect(call).toBeTruthy();
    const cb = call![1] as () => void;

    // Must not throw synchronously.
    expect(() => cb()).not.toThrow();

    // Give the rejected promise a tick to reach .catch().
    await new Promise((r) => setTimeout(r, 0));
  });
});
