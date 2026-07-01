import { defaultRanges, type MissingRanges } from "./simulation";
import type { StudentStatus } from "./gradeMath";

export type UrlMember = {
  id?: string;
  name: string;
  cloudXYZ: string;
  presentation: string;
  overall: string;
  status: StudentStatus;
  ranges: MissingRanges;
};

export type UrlState = {
  members: UrlMember[];
  seed: string;
};

export const SEED_EDITABLE = false;

export function generateSeed(random = Math.random): string {
  return `SNAKE-${Math.floor(random() * 90000 + 10000)}`;
}

export function refreshSeedState<T extends { seed: string; stale?: boolean }>(state: T, random = Math.random): T {
  return { ...state, seed: generateSeed(random), stale: true };
}

export function encodeUrlState(state: UrlState): string {
  const compact = {
    v: 2,
    s: state.seed,
    m: state.members.map((member) => [
      member.name,
      member.cloudXYZ,
      member.presentation,
      member.overall,
      member.status === "missing" ? 1 : 0,
      member.status === "missing" ? packRanges(member.ranges) : ""
    ])
  };
  return base64UrlEncode(JSON.stringify(compact));
}

export function decodeUrlState(value: string): UrlState | null {
  try {
    const raw = JSON.parse(base64UrlDecode(value)) as { s?: unknown; m?: unknown };
    if (!Array.isArray(raw.m) || typeof raw.s !== "string") return null;
    return {
      seed: raw.s,
      members: raw.m.map((row) => {
        if (!Array.isArray(row)) throw new Error("bad row");
        const status: StudentStatus = row[4] === 1 ? "missing" : "complete";
        return {
          name: String(row[0] ?? ""),
          cloudXYZ: String(row[1] ?? ""),
          presentation: String(row[2] ?? ""),
          overall: String(row[3] ?? ""),
          status,
          ranges: status === "missing" ? unpackRanges(String(row[5] ?? "")) : defaultRanges()
        };
      })
    };
  } catch {
    return null;
  }
}

function packRanges(ranges: MissingRanges): string {
  return (["x", "y", "z", "presentation", "overall"] as const)
    .map((key) => `${ranges[key].min}-${ranges[key].max}`)
    .join(".");
}

function unpackRanges(value: string): MissingRanges {
  const fallback = defaultRanges();
  const keys = ["x", "y", "z", "presentation", "overall"] as const;
  const parts = value.split(".");
  return keys.reduce((ranges, key, index) => {
    const [min, max] = (parts[index] || "").split("-").map(Number);
    ranges[key] = {
      min: Number.isFinite(min) ? min : fallback[key].min,
      max: Number.isFinite(max) ? max : fallback[key].max
    };
    return ranges;
  }, fallback);
}

function base64UrlEncode(value: string): string {
  return btoa(encodeURIComponent(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return decodeURIComponent(atob(padded));
}
