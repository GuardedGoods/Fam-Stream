import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateWatchlistStatus } from "../client";

describe("updateWatchlistStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to /api/user/watchlist with the correct body for 'watchlist'", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await updateWatchlistStatus(42, "watchlist");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    // Regression test: a past bug hit `/api/watchlist` which 404s silently.
    expect(url).toBe("/api/user/watchlist");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      movieId: 42,
      status: "watchlist",
    });
  });

  it("POSTs with status 'watched' for direct-watched path (no watchlist pre-step)", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await updateWatchlistStatus(7, "watched");

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      movieId: 7,
      status: "watched",
    });
  });

  it("routes null status to DELETE (regression: NOT NULL constraint)", async () => {
    // Previous shape: POST {status: null} — hit user_movies.status NOT NULL
    // and failed with a 500 that rolled back the UI silently. Null must
    // go through the DELETE endpoint instead.
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await updateWatchlistStatus(99, null);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/user/watchlist");
    expect(init?.method).toBe("DELETE");
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({ movieId: 99 });
    // Crucially, the body must NOT contain `status: null` — that's the
    // shape that used to trip NOT NULL on the server.
    expect(body).not.toHaveProperty("status");
  });

  it("throws on non-2xx POST responses so the caller can roll back UI", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 401, statusText: "Unauthorized" }),
    );

    await expect(updateWatchlistStatus(1, "watched")).rejects.toThrow(
      /401/,
    );
  });

  it("throws on non-2xx DELETE responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500, statusText: "Server Error" }),
    );

    await expect(updateWatchlistStatus(1, null)).rejects.toThrow(/500/);
  });
});
