import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * These tests verify that NextAuth is configured with a DrizzleAdapter and
 * the expected callbacks. They don't exercise the OAuth flow itself — they
 * pin the *wiring* so a future refactor that drops the adapter (the original
 * bug!) will fail loudly here.
 */

// Mock the Drizzle DB module so we don't open SQLite during tests.
vi.mock("@/lib/db", () => ({
  db: {},
}));
vi.mock("@/lib/db/schema", () => ({
  users: { _: "usersTable" },
  accounts: { _: "accountsTable" },
  sessions: { _: "sessionsTable" },
  verificationTokens: { _: "verificationTokensTable" },
}));

// Capture the arguments NextAuth was constructed with.
const nextAuthSpy = vi.fn(() => ({
  handlers: {},
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("next-auth", () => ({
  default: (cfg: unknown) => nextAuthSpy(cfg),
}));

vi.mock("next-auth/providers/google", () => ({
  default: (opts: unknown) => ({ id: "google", type: "oauth", opts }),
}));

// Sentinel adapter so we can assert it reached NextAuth.
const adapterSentinel = Symbol("drizzle-adapter");
vi.mock("@auth/drizzle-adapter", () => ({
  DrizzleAdapter: vi.fn(() => adapterSentinel),
}));

describe("auth config", () => {
  beforeEach(() => {
    vi.resetModules();
    nextAuthSpy.mockClear();
  });

  it("wires DrizzleAdapter into NextAuth", async () => {
    await import("../index");
    expect(nextAuthSpy).toHaveBeenCalledOnce();

    const cfg = nextAuthSpy.mock.calls[0][0] as {
      adapter?: unknown;
      session?: { strategy?: string };
      pages?: { signIn?: string };
    };

    expect(cfg.adapter).toBe(adapterSentinel);
    expect(cfg.session?.strategy).toBe("jwt");
    expect(cfg.pages?.signIn).toBe("/auth/signin");
  });

  it("session callback stamps user.id and user.isAdmin", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com,other@example.com";
    await import("../index");

    const cfg = nextAuthSpy.mock.calls[0][0] as {
      callbacks: {
        jwt: (args: {
          token: Record<string, unknown>;
          user?: { id: string };
        }) => Record<string, unknown>;
        session: (args: {
          session: { user?: Record<string, unknown> };
          token: Record<string, unknown>;
        }) => { user?: Record<string, unknown> };
      };
    };

    // Simulate jwt() then session() pipeline for an admin.
    let token: Record<string, unknown> = { email: "ADMIN@example.com" };
    token = cfg.callbacks.jwt({ token, user: { id: "u_123" } });
    expect(token.id).toBe("u_123");
    expect(token.isAdmin).toBe(true);

    const result = cfg.callbacks.session({
      session: { user: { name: "Admin" } },
      token,
    });
    expect(result.user?.id).toBe("u_123");
    expect(result.user?.isAdmin).toBe(true);
  });

  it("session callback marks non-admin emails correctly", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    await import("../index");

    const cfg = nextAuthSpy.mock.calls[0][0] as {
      callbacks: {
        jwt: (args: {
          token: Record<string, unknown>;
          user?: { id: string };
        }) => Record<string, unknown>;
      };
    };

    const token = cfg.callbacks.jwt({
      token: { email: "someone-else@example.com" },
      user: { id: "u_99" },
    });
    expect(token.isAdmin).toBe(false);
  });
});
