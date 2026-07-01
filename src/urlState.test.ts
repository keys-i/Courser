import { describe, expect, it } from "vitest";
import { defaultRanges } from "./simulation";
import { blankUrlMembers, decodeUrlState, decodeUrlStateOrBlank, encodeUrlState, generateSeed, refreshSeedState, SEED_EDITABLE } from "./urlState";

describe("url state", () => {
  it("round-trips compact state with seed and odd names", () => {
    const state = {
      seed: "SNAKE-48291",
      members: [
        {
          name: "A, B\nC",
          stageMarks: "765",
          presentation: "6",
          overall: "6.5",
          status: "present" as const,
          ranges: defaultRanges()
        },
        {
          name: "Ghost",
          stageMarks: "",
          presentation: "",
          overall: "",
          status: "missing" as const,
          ranges: defaultRanges()
        }
      ]
    };
    const encoded = encodeUrlState(state);
    expect(encoded).not.toContain("{");
    expect(encoded).toMatch(/^1\.S48291\./);
    expect(encoded.length).toBeLessThan(180);
    expect(decodeUrlState(encoded)).toEqual(state);
  });

  it("returns blank rows for weird links", () => {
    expect(decodeUrlState("not-valid")).toBeNull();
    expect(decodeUrlStateOrBlank("not-valid", "SNAKE-11111")).toEqual({ members: blankUrlMembers(), seed: "SNAKE-11111" });
  });

  it("keeps seed generated and immutable", () => {
    expect(generateSeed(() => 0.42545)).toBe("SNAKE-48290");
    expect(SEED_EDITABLE).toBe(false);
    expect(refreshSeedState({ seed: "SNAKE-12345", stale: false }, () => 0.9)).toEqual({ seed: "SNAKE-91000", stale: true });
  });

  it("is shorter than a verbose JSON-style state", () => {
    const state = {
      seed: "SNAKE-11111",
      members: [
        {
          name: "Teammate One",
          stageMarks: "777",
          presentation: "6",
          overall: "6.7",
          status: "present" as const,
          ranges: defaultRanges()
        }
      ]
    };
    const verbose = encodeURIComponent(JSON.stringify(state));
    expect(encodeUrlState(state).length).toBeLessThan(verbose.length);
  });
});
