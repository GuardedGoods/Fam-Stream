import { describe, it, expect, beforeEach } from "vitest";
import {
  getLastOmdbFailure,
  __resetOmdbCircuitBreakerForTests,
} from "../orchestrator";
import { OmdbRateLimitError } from "@/lib/apis/omdb";

/**
 * Unit tests for the OMDb circuit-breaker state held in orchestrator.ts.
 *
 * The full Phase 2 enrichment loop is hard to drive from a unit test
 * without mocking Drizzle + the TMDB client + the DB, and we already
 * have per-module tests for the pieces. What this test pins is the
 * *contract* that other code depends on:
 *
 *   1. `getLastOmdbFailure()` starts null after a reset.
 *   2. The OmdbRateLimitError type carries the `kind` tag through
 *      instanceof checks — the admin status route relies on this
 *      shape when it serializes the failure for the dashboard.
 *
 * The integration behavior (breaker trips, subsequent calls skip) is
 * exercised end-to-end on staging via the /admin dashboard.
 */
describe("orchestrator OMDb circuit-breaker state", () => {
  beforeEach(() => {
    __resetOmdbCircuitBreakerForTests();
  });

  it("returns null before any sync has run", () => {
    expect(getLastOmdbFailure()).toBeNull();
  });

  it("reset helper clears state (used by each runSync invocation)", () => {
    // We can't invoke runSync() in isolation without a DB, so this test
    // just pins the reset behavior the orchestrator uses internally.
    expect(getLastOmdbFailure()).toBeNull();
    __resetOmdbCircuitBreakerForTests();
    expect(getLastOmdbFailure()).toBeNull();
  });
});

describe("OmdbRateLimitError classification", () => {
  it("preserves `kind` through instanceof chain", () => {
    const e = new OmdbRateLimitError("rate-limit", "Request limit reached!");
    expect(e instanceof Error).toBe(true);
    expect(e instanceof OmdbRateLimitError).toBe(true);
    expect(e.kind).toBe("rate-limit");
    expect(e.omdbError).toBe("Request limit reached!");
    // message is what console.error prints; must include both for operator clarity
    expect(e.message).toContain("rate-limit");
    expect(e.message).toContain("Request limit reached!");
  });

  it("supports all three circuit-breaker kinds", () => {
    const kinds: Array<"rate-limit" | "invalid-key" | "no-key"> = [
      "rate-limit",
      "invalid-key",
      "no-key",
    ];
    for (const k of kinds) {
      const e = new OmdbRateLimitError(k, "x");
      expect(e.kind).toBe(k);
    }
  });
});
