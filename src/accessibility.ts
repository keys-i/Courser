export type Theme = "light" | "dark";

export type AccessibilitySettings = {
  reduceMotion: boolean;
  contrast: boolean;
  largeText: boolean;
  dyslexiaSpacing: boolean;
};

export const defaultAccessibility = (systemReducedMotion = false): AccessibilitySettings => ({
  reduceMotion: systemReducedMotion,
  contrast: false,
  largeText: false,
  dyslexiaSpacing: false
});

export function themeToggleLabel(theme: Theme): string {
  return theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
}

export function animationMode(settings: AccessibilitySettings, systemReducedMotion = false): "reduced" | "motion" {
  return settings.reduceMotion || systemReducedMotion ? "reduced" : "motion";
}

export function serializeAccessibility(settings: AccessibilitySettings): string {
  return JSON.stringify(settings);
}

export function parseAccessibility(value: string | null, systemReducedMotion = false): AccessibilitySettings {
  if (!value) return defaultAccessibility(systemReducedMotion);
  try {
    return { ...defaultAccessibility(systemReducedMotion), ...JSON.parse(value) };
  } catch {
    return defaultAccessibility(systemReducedMotion);
  }
}
