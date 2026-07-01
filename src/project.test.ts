import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  animationMode,
  defaultAccessibility,
  parseAccessibility,
  serializeAccessibility,
  themeToggleLabel
} from "./accessibility";
import { TRUSTED_FORMULAS } from "./constants";
import { SEED_EDITABLE, decodeUrlState, encodeUrlState, generateSeed, refreshSeedState } from "./urlState";
import { defaultRanges } from "./simulation";

describe("project edge cases", () => {
  it("round-trips compact URL state", () => {
    const state = {
      seed: "SNAKE-48291",
      members: [
        { name: "Teammate 1", cloudXYZ: "574", presentation: "6", overall: "7", status: "complete" as const, ranges: defaultRanges() },
        { name: "Mystery", cloudXYZ: "", presentation: "", overall: "", status: "missing" as const, ranges: defaultRanges() }
      ]
    };
    expect(decodeUrlState(encodeUrlState(state))).toEqual(state);
  });

  it("uses readable generated seeds and refresh marks stale", () => {
    expect(generateSeed(() => 0.42545)).toBe("SNAKE-48290");
    expect(generateSeed(() => 0)).toMatch(/^SNAKE-\d{5}$/);
    expect(refreshSeedState({ seed: "SNAKE-11111", stale: false }, () => 0.5)).toEqual({
      seed: "SNAKE-55000",
      stale: true
    });
    expect(SEED_EDITABLE).toBe(false);
  });

  it("has accessible theme labels and persistent accessibility settings", () => {
    expect(themeToggleLabel("light")).toBe("Switch to dark mode");
    expect(themeToggleLabel("dark")).toBe("Switch to light mode");
    const settings = { ...defaultAccessibility(false), reduceMotion: true, contrast: true };
    expect(parseAccessibility(serializeAccessibility(settings))).toEqual(settings);
    expect(animationMode(settings)).toBe("reduced");
  });

  it("keeps formula rendering on trusted constants only", () => {
    expect(TRUSTED_FORMULAS).toHaveLength(6);
    expect(TRUSTED_FORMULAS.every((formula) => formula.tex.length > 0)).toBe(true);
  });

  it("has license and README metadata", () => {
    expect(JSON.parse(readFileSync("package.json", "utf8")).license).toBe("MIT");
    expect(readFileSync("LICENSE", "utf8")).toContain("Copyright (c) 2026 Rad");
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("# Courser - CSSE6400");
    expect(readme).toContain("MIT License");
  });

  it("uses Courser as the website hero brand", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    expect(app).toContain("<h1>Courser</h1>");
    expect(app).not.toContain("<h1>Courser - CSSE6400</h1>");
  });
});
