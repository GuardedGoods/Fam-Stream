import { describe, it, expect } from "vitest";
import {
  isPositiveInt,
  clampInt,
  clampScore,
  escapeLikePattern,
  validateIdArray,
} from "../validation";

describe("isPositiveInt", () => {
  it("accepts positive integers", () => {
    expect(isPositiveInt(1)).toBe(true);
    expect(isPositiveInt(999)).toBe(true);
  });

  it("rejects zero, negatives, floats, non-numbers", () => {
    expect(isPositiveInt(0)).toBe(false);
    expect(isPositiveInt(-1)).toBe(false);
    expect(isPositiveInt(1.5)).toBe(false);
    expect(isPositiveInt("1")).toBe(false);
    expect(isPositiveInt(null)).toBe(false);
    expect(isPositiveInt(undefined)).toBe(false);
    expect(isPositiveInt(NaN)).toBe(false);
  });
});

describe("clampInt", () => {
  it("returns fallback for null/undefined/empty", () => {
    expect(clampInt(null, 1, 100, 24)).toBe(24);
    expect(clampInt(undefined, 1, 100, 24)).toBe(24);
    expect(clampInt("", 1, 100, 24)).toBe(24);
  });

  it("returns fallback for non-numeric strings", () => {
    expect(clampInt("abc", 1, 100, 24)).toBe(24);
    expect(clampInt("NaN", 1, 100, 24)).toBe(24);
  });

  it("clamps to min", () => {
    expect(clampInt("-5", 1, 100, 24)).toBe(1);
    expect(clampInt("0", 1, 100, 24)).toBe(1);
  });

  it("clamps to max", () => {
    expect(clampInt("999999", 1, 100, 24)).toBe(100);
  });

  it("passes through valid values", () => {
    expect(clampInt("50", 1, 100, 24)).toBe(50);
    expect(clampInt("1", 1, 100, 24)).toBe(1);
    expect(clampInt("100", 1, 100, 24)).toBe(100);
  });
});

describe("clampScore", () => {
  it("clamps to 0-5 range", () => {
    expect(clampScore(-1, 2)).toBe(0);
    expect(clampScore(6, 2)).toBe(5);
    expect(clampScore(999, 2)).toBe(5);
    expect(clampScore(3, 2)).toBe(3);
  });

  it("rounds floats", () => {
    expect(clampScore(2.7, 2)).toBe(3);
    expect(clampScore(2.3, 2)).toBe(2);
  });

  it("returns fallback for non-numbers", () => {
    expect(clampScore("3", 2)).toBe(2);
    expect(clampScore(null, 2)).toBe(2);
    expect(clampScore(undefined, 2)).toBe(2);
    expect(clampScore(NaN, 2)).toBe(2);
  });
});

describe("escapeLikePattern", () => {
  it("escapes % and _ metacharacters", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("under_score")).toBe("under\\_score");
    expect(escapeLikePattern("%_%")).toBe("\\%\\_\\%");
  });

  it("leaves normal strings untouched", () => {
    expect(escapeLikePattern("hello")).toBe("hello");
    expect(escapeLikePattern("")).toBe("");
  });
});

describe("validateIdArray", () => {
  it("accepts arrays of positive integers", () => {
    expect(validateIdArray([1, 2, 3])).toEqual([1, 2, 3]);
    expect(validateIdArray([])).toEqual([]);
  });

  it("rejects non-arrays", () => {
    expect(validateIdArray("not an array")).toBeNull();
    expect(validateIdArray(42)).toBeNull();
    expect(validateIdArray(null)).toBeNull();
  });

  it("rejects arrays with invalid contents", () => {
    expect(validateIdArray([1, "2", 3])).toBeNull();
    expect(validateIdArray([1, -1, 3])).toBeNull();
    expect(validateIdArray([1, 0, 3])).toBeNull();
    expect(validateIdArray([1, null, 3])).toBeNull();
    expect(validateIdArray([1, 1.5, 3])).toBeNull();
  });
});
