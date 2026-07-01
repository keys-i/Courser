import { describe, expect, it, test } from "vitest";
import { defaultRanges } from "./simulation";
import {
  SHARE_KEY_PREFIX,
  SHARE_INDEX_KEY,
  SHARE_TOKEN_ALPHABET,
  SHARE_TOKEN_RE,
  blankUrlMembers,
  generateSeed,
  generateShareToken,
  hashToken,
  loadShareHash,
  loadShareToken,
  makeShareLink,
  refreshSeedState,
  storeShareState,
  validShareToken,
  SEED_EDITABLE,
  type UrlState
} from "./urlState";

const state: UrlState = {
  seed: "SNAKE-48291",
  members: [
    {
      name: "A, B\nC",
      stageMarks: "765",
      presentation: "6",
      overall: "6.5",
      status: "present",
      ranges: defaultRanges()
    }
  ]
};

describe("url state", () => {
  test.each([0, 0.25, 0.99])("generates six-character tokens from the safe alphabet", (value) => {
    const token = generateShareToken(memoryStorage(), () => value);
    expect(token).toHaveLength(6);
    expect(token).toMatch(SHARE_TOKEN_RE);
    expect([...token].every((char) => SHARE_TOKEN_ALPHABET.includes(char))).toBe(true);
    expect(token).not.toMatch(/[0OIl1]/);
  });

  test.each(["#k7PaQ2", "S9xQ2m", "#paf7kL"])("accepts valid hash %s", (hash) => {
    expect(hashToken(hash).token).toBe(hash.replace(/^#/, ""));
  });

  test.each(["#abc", "#000000", "#OOOOOO", "#llllll", "#123456", "#toolong999"])("rejects invalid hash %s", (hash) => {
    expect(validShareToken(hash.replace(/^#/, ""))).toBe(false);
    expect(hashToken(hash).error).toBe("invalid");
  });

  it("regenerates on collision and falls back to eight characters after ten tries", () => {
    const storage = memoryStorage();
    storage.setItem(`${SHARE_KEY_PREFIX}222222`, "{}");
    expect(generateShareToken(storage, sequence(Array(60).fill(0)))).toHaveLength(8);
  });

  it("stores, loads, and cleans old share states", () => {
    const storage = memoryStorage();
    const saved = storeShareState(storage, state, () => 0.1, () => 1);
    expect(saved?.token).toHaveLength(6);
    expect(loadShareToken(storage, saved!.token)).toEqual(state);

    for (let i = 0; i < 30; i++) {
      storeShareState(storage, { ...state, seed: `SNAKE-${String(10000 + i).padStart(5, "0")}` }, () => i / 100, () => i + 2);
    }
    const keys = storage.keys().filter((key) => key.startsWith(SHARE_KEY_PREFIX) && key !== SHARE_INDEX_KEY);
    expect(keys.length).toBe(25);
  });

  it("returns a safe blank squad for missing or invalid hashes", () => {
    const storage = memoryStorage();
    expect(loadShareHash(storage, "#bad").message).toBe("That link looks weird");
    expect(loadShareHash(storage, "#k7PaQ2")).toEqual({
      state: { members: blankUrlMembers(), seed: expect.stringMatching(/^SNAKE-\d{5}$/) },
      message: "Link token not found on this browser"
    });
  });

  it("falls back cleanly when storage is blocked", () => {
    expect(storeShareState(blockedStorage(), state)).toBeNull();
  });

  it("creates tiny hash links without query state", () => {
    const link = makeShareLink("https://site.test", "/courser/", "k7PaQ2");
    expect(link).toBe("https://site.test/courser/#k7PaQ2");
    expect(link.length).toBeLessThan(80);
    expect(link).not.toContain("?s=");
  });

  it("keeps seed generated and immutable", () => {
    expect(generateSeed(() => 0.42545)).toBe("SNAKE-48290");
    expect(SEED_EDITABLE).toBe(false);
    expect(refreshSeedState({ seed: "SNAKE-12345", stale: false }, () => 0.9)).toEqual({ seed: "SNAKE-91000", stale: true });
  });
});

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    keys: () => [...map.keys()]
  };
}

function blockedStorage() {
  return {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    }
  };
}

function sequence(values: number[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}
