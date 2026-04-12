import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMovieByImdbId, OmdbRateLimitError } from "../omdb";

/**
 * OMDb's API is quirky: it returns HTTP 200 for every error case, with
 * the failure encoded in a JSON body's `Response` + `Error` fields. The
 * client code must distinguish:
 *   - happy path                      → parsed movie
 *   - "Movie not found!"              → null  (one-off, per-movie)
 *   - "Incorrect IMDb ID."            → null  (one-off, per-movie)
 *   - "Request limit reached!"        → throw OmdbRateLimitError("rate-limit")
 *   - "Invalid API key!"              → throw OmdbRateLimitError("invalid-key")
 *   - "No API key provided."          → throw OmdbRateLimitError("no-key")
 *   - anything else                   → throw generic Error
 *
 * These cases exist because until Phase 4E, the client threw on ALL
 * non-"not found" errors indiscriminately, and the orchestrator's outer
 * try/catch swallowed the throw before writing ratings — so a rate-limit
 * day silently broke RT/Metacritic/IMDb enrichment for the whole catalog.
 */

function mockOmdbResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
  } as Response;
}

const originalFetch = global.fetch;
const originalKey = process.env.OMDB_API_KEY;

beforeEach(() => {
  process.env.OMDB_API_KEY = "test-key";
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OMDB_API_KEY;
  else process.env.OMDB_API_KEY = originalKey;
});

describe("getMovieByImdbId", () => {
  it("parses a happy-path response into ParsedOmdbMovie", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockOmdbResponse({
        Response: "True",
        Title: "Inside Out",
        Year: "2015",
        Rated: "PG",
        Runtime: "95 min",
        Genre: "Animation, Adventure, Comedy",
        Director: "Pete Docter",
        Actors: "Amy Poehler, Bill Hader",
        Plot: "Her parents' divorce...",
        Poster: "https://m.media-amazon.com/images/...",
        Ratings: [
          { Source: "Internet Movie Database", Value: "8.1/10" },
          { Source: "Rotten Tomatoes", Value: "98%" },
          { Source: "Metacritic", Value: "94/100" },
        ],
        Metascore: "94",
        imdbRating: "8.1",
        imdbID: "tt2096673",
      }),
    );

    const result = await getMovieByImdbId("tt2096673");

    expect(result).not.toBeNull();
    expect(result?.rottenTomatoesScore).toBe(98);
    expect(result?.metacriticScore).toBe(94);
    expect(result?.imdbRating).toBeCloseTo(8.1);
  });

  it("returns null for 'Movie not found!' (per-movie, not fatal)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockOmdbResponse({ Response: "False", Error: "Movie not found!" }),
    );
    const result = await getMovieByImdbId("tt0000000");
    expect(result).toBeNull();
  });

  it("throws OmdbRateLimitError('rate-limit') on quota exhaustion", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockOmdbResponse({
        Response: "False",
        Error: "Request limit reached!",
      }),
    );

    await expect(getMovieByImdbId("tt0111161")).rejects.toThrow(
      OmdbRateLimitError,
    );

    // Re-trigger to inspect the `kind` tag directly
    try {
      await getMovieByImdbId("tt0111161");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OmdbRateLimitError);
      expect((e as OmdbRateLimitError).kind).toBe("rate-limit");
      expect((e as OmdbRateLimitError).omdbError).toBe(
        "Request limit reached!",
      );
    }
  });

  it("throws OmdbRateLimitError('invalid-key') on key rejection", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockOmdbResponse({ Response: "False", Error: "Invalid API key!" }),
    );

    try {
      await getMovieByImdbId("tt0111161");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OmdbRateLimitError);
      expect((e as OmdbRateLimitError).kind).toBe("invalid-key");
    }
  });

  it("throws OmdbRateLimitError('no-key') when API says key is missing", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockOmdbResponse({ Response: "False", Error: "No API key provided." }),
    );

    try {
      await getMovieByImdbId("tt0111161");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OmdbRateLimitError);
      expect((e as OmdbRateLimitError).kind).toBe("no-key");
    }
  });

  it("throws a generic Error for unknown OMDb error strings", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockOmdbResponse({
        Response: "False",
        Error: "Something we've never seen before",
      }),
    );

    await expect(getMovieByImdbId("tt0111161")).rejects.toThrow(
      /OMDb API error: Something/,
    );
    await expect(getMovieByImdbId("tt0111161")).rejects.not.toBeInstanceOf(
      OmdbRateLimitError,
    );
  });
});
