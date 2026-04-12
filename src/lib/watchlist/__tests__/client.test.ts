import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateWatchlistStatus } from "../client";

describe("updateWatchlistStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to /api/user/watchlist with the correct body", async () => {
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

  it("passes null status through (for removal)", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await updateWatchlistStatus(7, null);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      movieId: 7,
      status: null,
    });
  });

  it("throws on non-2xx responses so the caller can roll back UI", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 401, statusText: "Unauthorized" }),
    );

    await expect(updateWatchlistStatus(1, "watched")).rejects.toThrow(
      /401/,
    );
  });
});
