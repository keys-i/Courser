import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GITHUB_PROFILE_URL, TRUSTED_FORMULAS } from "./constants";

const app = () => readFileSync("src/App.tsx", "utf8");
const css = () => readFileSync("src/styles.css", "utf8");

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
    expect(source).toContain('text: "Result"');
    expect(source).toContain("Results Ready");
    expect(source).toContain("Results Unavailable");
    expect(source).toContain("Individual project grade");
    expect(source).toContain("PAF 1.00 means 100% contribution");
    expect(source).toContain("What PAF means");
    expect(source).toContain("PAF Reality Check");
    expect(source).toContain("For missing marks and ghost teammates");
    expect(source).not.toContain("Load Radhesh example");
    expect(source).not.toContain("Radhesh");
    expect(source).not.toContain("Peer evaluation display");
    expect(source).not.toContain("Stop the snake");
    expect(source).not.toContain("Result Table");
    expect(source).not.toContain("Sorted by PAF");
    expect(source).not.toContain("wildlife documentaries");
    expect(source).not.toContain("Final project grade after PAF");
    expect(source).not.toContain("Individual project grade after PAF");
    expect(source).not.toContain("Hex Check");
    expect(source).not.toContain("Monte Carlo Labs");
  });

  it("shows stages, not old cloud wording", () => {
    const source = app();
    expect(source).toContain("Stage marks");
    expect(source).toContain("e.g. 754");
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
    expect(source).toContain("Focus boost");
    expect(source).toContain("Pause mascot");
    expect(source).toContain("Seed: {seed}");
    expect(source).toContain("Refresh seed");
    expect(source).toContain("Copy short link");
    expect(source).toContain("Short links work on this browser");
    expect(source).not.toContain("?s=");
    expect(source).not.toContain("<input value={seed}");
  });

  it("keeps the snake animation as the visible loading treatment", () => {
    const source = app();
    expect(source).toContain("accountant-snake");
    expect(source).toContain("paf-chip");
    expect(source).toContain("ready-chip");
    expect(source).not.toContain("<progress");
  });

  it("keeps docs and formula rendering trusted", () => {
    expect(TRUSTED_FORMULAS.length).toBeGreaterThanOrEqual(7);
  });

  it("keeps Quick Read in page flow on small screens", () => {
    expect(css()).toContain(".summary");
    expect(css()).not.toContain(".summary {\n  position: fixed");
  });
});
