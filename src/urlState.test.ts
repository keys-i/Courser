import { describe, expect, it } from "vitest";
import { RADHESH_RELEASED_EXAMPLE } from "./constants";
import { defaultRanges } from "./simulation";
import { blankUrlMembers, decodeUrlState, decodeUrlStateOrBlank, encodeUrlState, generateSeed, refreshSeedState, SEED_EDITABLE } from "./urlState";

describe("url state", () => {
  it("round-trips compact state with seed and odd names", () => {
    const state = {
      seed: "SNAKE-48291",
      members: [
        {
          name: "A, B\nC",
          stage1: "7",
          stage2: "6",
          stage3: "5",
          presentation: "6",
          teamCapstone: "7",
          individualProject: "6.5",
          overall: "",
          status: "complete" as const,
          ranges: defaultRanges()
        },
        {
          name: "Ghost",
          stage1: "",
          stage2: "",
          stage3: "",
          presentation: "",
          teamCapstone: "",
          individualProject: "",
          overall: "",
          status: "missing" as const,
          ranges: defaultRanges()
        }
      ]
    };
    const encoded = encodeUrlState(state);
    expect(encoded).not.toContain("{");
    expect(encoded.length).toBeLessThan(700);
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

  it("only includes demo marks when that state is encoded", () => {
    const blank = encodeUrlState({ seed: "SNAKE-11111", members: blankUrlMembers() });
    const demo = encodeUrlState({
      seed: "SNAKE-11111",
      members: [
        {
          name: RADHESH_RELEASED_EXAMPLE.name,
          stage1: "7",
          stage2: "7",
          stage3: "7",
          presentation: "6",
          teamCapstone: "7",
          individualProject: "7",
          overall: "",
          status: "complete",
          ranges: defaultRanges()
        }
      ]
    });
    expect(decodeUrlState(blank)?.members.some((member) => member.name === RADHESH_RELEASED_EXAMPLE.name)).toBe(false);
    expect(decodeUrlState(demo)?.members[0].name).toBe(RADHESH_RELEASED_EXAMPLE.name);
  });
});
