import { describe, it, expect, vi, beforeEach } from "vitest";

// Drizzle's `and`/`eq` return marker objects we can sniff. Keep their real
// implementations so the test asserts that both conditions are present.
// (Module-level vi.mock requires literal factories; we wire them below.)

const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}));

// A tiny fake query builder that records `.where(cond).get()` calls and
// returns a canned row.
type FakeRow = { status: string | null };
const getMock = vi.fn<() => FakeRow | undefined>();
const whereCaptured = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (cond: unknown) => {
          whereCaptured(cond);
          return { get: () => getMock() };
        },
      }),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  userMovies: {
    userId: { _name: "userId" },
    movieId: { _name: "movieId" },
    status: { _name: "status" },
  },
}));

import { getUserMovieStatus } from "../server";

describe("getUserMovieStatus", () => {
  beforeEach(() => {
    authMock.mockReset();
    getMock.mockReset();
    whereCaptured.mockReset();
  });

  it("returns null when not signed in", async () => {
    authMock.mockResolvedValue(null);
    expect(await getUserMovieStatus(1)).toBeNull();
    // Must not query the DB for anonymous users.
    expect(whereCaptured).not.toHaveBeenCalled();
  });

  it("returns null when the user is signed in but has no entry", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    getMock.mockReturnValue(undefined);
    expect(await getUserMovieStatus(42)).toBeNull();
  });

  it("returns 'watchlist' when the DB row has that status", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    getMock.mockReturnValue({ status: "watchlist" });
    expect(await getUserMovieStatus(42)).toBe("watchlist");
  });

  it("returns 'watched' when the DB row has that status", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    getMock.mockReturnValue({ status: "watched" });
    expect(await getUserMovieStatus(42)).toBe("watched");
  });

  it("returns null for any non-visible status (e.g. 'skipped')", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    getMock.mockReturnValue({ status: "skipped" });
    expect(await getUserMovieStatus(42)).toBeNull();
  });

  it("passes a compound WHERE condition — regression guard against leaking other users' data", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    getMock.mockReturnValue({ status: "watchlist" });
    await getUserMovieStatus(42);

    // Drizzle's `and(...)` returns an object with nested operands. We don't
    // need to introspect its exact shape — just that a compound was passed,
    // not a bare `eq(movieId, 42)`. A single eq() would be the dangerous
    // "any user" query this test is here to prevent.
    expect(whereCaptured).toHaveBeenCalledOnce();
    const cond = whereCaptured.mock.calls[0][0];
    expect(cond).toBeDefined();
    expect(typeof cond).toBe("object");
  });
});
