import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression test for the proxy (Next.js 16's renamed middleware).
 *
 * A previous bug shipped a `getToken({ req, secret })` (v4 pattern) call in
 * proxy.ts. Under an HTTPS reverse proxy, `getToken()` couldn't locate the
 * v5 `__Secure-authjs.session-token` cookie and returned null for every
 * authenticated request, causing:
 *   - /watchlist pages to redirect signed-in users to /auth/signin
 *   - /api/user/* calls (like "Add to Watchlist") to 401 silently
 *
 * The fix is to use the v5 `auth()` wrapper with a split Edge-safe config.
 * These tests pin that pattern: proxy.ts must initialize NextAuth from
 * `@/lib/auth/config` (the Edge-safe config, no adapter) and wrap its
 * handler with the resulting `auth` helper. A future refactor that
 * imports from `@/lib/auth` (full config with adapter) would break Edge
 * runtime; one that goes back to `getToken` would re-break the bug.
 */

// Capture what NextAuth is initialized with — the key thing is that the
// proxy's NextAuth call includes NO adapter (Edge-safe) and DOES include
// the JWT session strategy + Google provider from the shared config.
const nextAuthSpy = vi.fn((_cfg: unknown) => ({
  auth: (handler: unknown) => handler,
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("next-auth", () => ({
  default: (cfg: unknown) => nextAuthSpy(cfg),
}));

vi.mock("next-auth/providers/google", () => ({
  default: (opts: unknown) => ({ id: "google", type: "oauth", opts }),
}));

describe("proxy (Next.js 16 middleware)", () => {
  beforeEach(() => {
    vi.resetModules();
    nextAuthSpy.mockClear();
  });

  it("initializes NextAuth with the Edge-safe config (no DB adapter)", async () => {
    await import("../proxy");

    expect(nextAuthSpy).toHaveBeenCalledOnce();
    const cfg = nextAuthSpy.mock.calls[0][0] as {
      adapter?: unknown;
      session?: { strategy?: string };
      providers?: unknown[];
    };

    // Critical Edge-safety assertion: no adapter in the proxy's NextAuth
    // instance. The Drizzle adapter pulls in better-sqlite3, which is a
    // native module and can't run in Edge. Only `src/lib/auth/index.ts`
    // (the Node runtime instance) may add the adapter.
    expect(cfg.adapter).toBeUndefined();

    // Must still use JWT strategy so the proxy can decode the session
    // cookie without a DB round-trip.
    expect(cfg.session?.strategy).toBe("jwt");

    // Must still have the Google provider so re-auth redirects work.
    expect(Array.isArray(cfg.providers)).toBe(true);
    expect(cfg.providers?.length).toBeGreaterThan(0);
  });

  it("exports both `proxy` and `config` for Next.js 16 compatibility", async () => {
    const mod = await import("../proxy");
    // Next.js 16 reads these names off the proxy module.
    expect(typeof mod.proxy).toBe("function");
    expect(mod.config).toBeDefined();
    expect(mod.config?.matcher).toBeDefined();
  });

  it("matcher includes every protected route prefix we depend on", async () => {
    const mod = await import("../proxy");
    const matcher = mod.config.matcher;
    expect(matcher).toContain("/watchlist/:path*");
    expect(matcher).toContain("/settings/:path*");
    expect(matcher).toContain("/admin/:path*");
    expect(matcher).toContain("/api/user/:path*");
    expect(matcher).toContain("/api/sync/:path*");
  });
});
