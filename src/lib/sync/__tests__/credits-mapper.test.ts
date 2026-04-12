import { describe, it, expect } from "vitest";
import { mapCreditsToRows } from "../credits-mapper";
import type { TmdbCreditsResponse } from "@/lib/apis/tmdb";

function makeCredits(partial: Partial<TmdbCreditsResponse>): TmdbCreditsResponse {
  return {
    id: 1,
    cast: [],
    crew: [],
    ...partial,
  };
}

describe("mapCreditsToRows", () => {
  it("keeps top cast by order ascending (0 = lead)", () => {
    const result = mapCreditsToRows(
      makeCredits({
        cast: [
          { id: 3, name: "Third", character: "C", profile_path: null, order: 2 },
          { id: 1, name: "Lead", character: "A", profile_path: null, order: 0 },
          { id: 2, name: "Second", character: "B", profile_path: null, order: 1 },
        ],
      }),
    );

    expect(result.map((r) => r.name)).toEqual(["Lead", "Second", "Third"]);
    expect(result.every((r) => r.isCrew === 0)).toBe(true);
  });

  it("caps cast at 12 members", () => {
    const cast = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      name: `Actor ${i}`,
      character: `Role ${i}`,
      profile_path: null,
      order: i,
    }));
    const result = mapCreditsToRows(makeCredits({ cast }));
    expect(result.length).toBe(12);
  });

  it("keeps only Director / Writer / Screenplay crew jobs", () => {
    const result = mapCreditsToRows(
      makeCredits({
        crew: [
          { id: 100, name: "DOP", job: "Director of Photography", department: "Camera", profile_path: null },
          { id: 101, name: "Ms. Director", job: "Director", department: "Directing", profile_path: null },
          { id: 102, name: "Mr. Writer", job: "Writer", department: "Writing", profile_path: null },
          { id: 103, name: "Composer", job: "Original Music Composer", department: "Sound", profile_path: null },
        ],
      }),
    );

    expect(result.map((r) => r.name).sort()).toEqual(["Mr. Writer", "Ms. Director"]);
    expect(result.every((r) => r.isCrew === 1)).toBe(true);
  });

  it("allows the same person as both cast and director (different crewJob key)", () => {
    const result = mapCreditsToRows(
      makeCredits({
        cast: [
          { id: 42, name: "Greta Gerwig", character: "Herself", profile_path: null, order: 0 },
        ],
        crew: [
          { id: 42, name: "Greta Gerwig", job: "Director", department: "Directing", profile_path: null },
        ],
      }),
    );

    expect(result.length).toBe(2);
    expect(result[0].isCrew).toBe(0);
    expect(result[0].character).toBe("Herself");
    expect(result[1].isCrew).toBe(1);
    expect(result[1].crewJob).toBe("Director");
  });

  it("skips cast/crew with missing names (defensive)", () => {
    const result = mapCreditsToRows(
      makeCredits({
        cast: [
          { id: 1, name: "", character: "X", profile_path: null, order: 0 },
          { id: 2, name: "Real Actor", character: "Y", profile_path: null, order: 1 },
        ],
        crew: [
          // @ts-expect-error deliberately malformed
          { id: 3, name: null, job: "Director", department: "Directing", profile_path: null },
        ],
      }),
    );

    expect(result.map((r) => r.name)).toEqual(["Real Actor"]);
  });

  it("trims overlong character names to 120 chars", () => {
    const longName = "x".repeat(200);
    const result = mapCreditsToRows(
      makeCredits({
        cast: [
          { id: 1, name: "A", character: longName, profile_path: null, order: 0 },
        ],
      }),
    );
    expect(result[0].character?.length).toBe(120);
  });

  it("returns an empty array for an empty credits response", () => {
    expect(mapCreditsToRows(makeCredits({}))).toEqual([]);
  });
});
