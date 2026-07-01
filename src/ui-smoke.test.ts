import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GITHUB_PROFILE_URL, TRUSTED_FORMULAS } from "./constants";

const app = () => readFileSync("src/App.tsx", "utf8");
const readme = () => readFileSync("README.md", "utf8");

describe("ui smoke", () => {
  it("keeps the website brand short", () => {
    const source = app();
    expect(source).toContain("<h1>Courser</h1>");
    expect(source).not.toContain("<h1>Courser - CSSE6400</h1>");
    expect(source).not.toContain("Definitely not Cursor");
    expect(source).not.toContain("Marks in. Panic out");
  });

  it("uses the released-grade UI wording", () => {
    const source = app();
    expect(source).toContain("<h2>Result</h2>");
    expect(source).toContain("Individual project grade after PAF");
    expect(source).toContain("PAF Reality Check");
    expect(source).toContain("Load Radhesh example");
    expect(source).toContain("Feedback item only, not the PAF");
    expect(source).not.toContain("Result Table");
    expect(source).not.toContain("Sorted by PAF");
    expect(source).not.toContain("wildlife documentaries");
    expect(source).not.toContain("Final project grade after PAF");
  });

  it("shows stages, not old cloud wording", () => {
    const source = app();
    expect(source).toContain("API Functionality");
    expect(source).toContain("Deployed to Cloud");
    expect(source).toContain("Scalable Application");
    expect(source).not.toContain("Cloud XYZ");
  });

  it("has accessible controls for GitHub, accessibility, and seed", () => {
    const source = app();
    expect(GITHUB_PROFILE_URL).toBe("https://github.com/keys-i");
    expect(source).toContain('aria-label="Open Rad’s GitHub"');
    expect(source).toContain('aria-label="Accessibility settings"');
    expect(source).toContain("Seed: {seed}");
    expect(source).toContain("Refresh seed");
    expect(source).not.toContain("<input value={seed}");
  });

  it("keeps docs and formula rendering trusted", () => {
    expect(TRUSTED_FORMULAS.length).toBeGreaterThanOrEqual(7);
    expect(readme()).toContain("```math");
    expect(readme()).toContain("MIT License");
    expect(readme()).toContain("CI/CD");
  });
});
