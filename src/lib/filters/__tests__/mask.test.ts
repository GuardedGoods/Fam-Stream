import { describe, it, expect } from "vitest";
import { maskProfanity } from "../mask";

describe("maskProfanity", () => {
  it("masks the interior of a 4-letter word", () => {
    expect(maskProfanity("damn")).toBe("d--n");
  });

  it("masks the interior of a longer word", () => {
    expect(maskProfanity("bastard")).toBe("b-----d");
  });

  it("keeps 3-letter words as first-dash-last", () => {
    expect(maskProfanity("ass")).toBe("a-s");
  });

  it("leaves strings of length 2 or less unchanged", () => {
    expect(maskProfanity("")).toBe("");
    expect(maskProfanity("a")).toBe("a");
    expect(maskProfanity("ab")).toBe("ab");
  });

  it("leaves pre-masked / hyphenated labels alone", () => {
    expect(maskProfanity("f-word")).toBe("f-word");
    expect(maskProfanity("s-word")).toBe("s-word");
  });

  it("preserves case", () => {
    expect(maskProfanity("DAMN")).toBe("D--N");
    expect(maskProfanity("Crap")).toBe("C--p");
  });
});
