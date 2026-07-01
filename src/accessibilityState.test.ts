import { describe, expect, it } from "vitest";
import { animationMode, defaultAccessibility, parseAccessibility, serializeAccessibility, themeToggleLabel } from "./accessibility";

describe("accessibility state", () => {
  it("respects reduced motion defaults and settings", () => {
    expect(defaultAccessibility(true).reduceMotion).toBe(true);
    expect(animationMode(defaultAccessibility(true), true)).toBe("reduced");
    expect(animationMode(defaultAccessibility(false), false)).toBe("motion");
  });

  it("persists and resets simple settings", () => {
    const settings = { ...defaultAccessibility(false), reduceMotion: true, largeText: true, dyslexiaSpacing: true };
    expect(parseAccessibility(serializeAccessibility(settings))).toEqual(settings);
    expect(parseAccessibility("{nope", true)).toEqual(defaultAccessibility(true));
  });

  it("labels the theme toggle accessibly", () => {
    expect(themeToggleLabel("light")).toBe("Switch to dark mode");
    expect(themeToggleLabel("dark")).toBe("Switch to light mode");
  });
});
