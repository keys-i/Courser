import { defaultRanges, type MissingRanges } from "./simulation";
import type { StudentStatus } from "./gradeMath";

export type UrlMember = {
  id?: string;
  name: string;
  stageMarks: string;
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
  const rows = trimBlankTail(state.members)
    .map((member) => {
      const fields = [
        safe(member.name),
        member.stageMarks,
        member.presentation,
        member.overall,
        member.status === "missing" ? "m" : "p"
      ];
      if (member.status === "missing") fields.push(packRanges(member.ranges));
      return fields.join(":");
    })
    .join(";");
  return ["1", state.seed.replace("SNAKE-", "S"), rows].join(".");
}

export function decodeUrlState(value: string): UrlState | null {
  try {
    const firstDot = value.indexOf(".");
    const secondDot = value.indexOf(".", firstDot + 1);
    if (firstDot < 0 || secondDot < 0) return null;
    const version = value.slice(0, firstDot);
    const seedPart = value.slice(firstDot + 1, secondDot);
    const rowsPart = value.slice(secondDot + 1);
    if (version !== "1" || !/^S\d{5}$/.test(seedPart)) return null;
    const rows = rowsPart ? rowsPart.split(";").map(unpackRow) : blankUrlMembers();
    return { seed: `SNAKE-${seedPart.slice(1)}`, members: rows.length ? rows : blankUrlMembers() };
  } catch {
    return null;
  }
}

export function blankUrlMembers(count = 3): UrlMember[] {
  return Array.from({ length: count }, () => ({
    name: "",
    stageMarks: "",
    presentation: "",
    overall: "",
    status: "present",
    ranges: defaultRanges()
  }));
}

export function decodeUrlStateOrBlank(value: string, seed = generateSeed()): UrlState {
  return decodeUrlState(value) ?? { members: blankUrlMembers(), seed };
}

function unpackRow(value: string): UrlMember {
  const [name = "", stageMarks = "", presentation = "", overall = "", statusRaw = "p", rangesRaw = ""] = value.split(":");
  const status: StudentStatus = statusRaw === "m" ? "missing" : "present";
  return {
    name: unsafe(name),
    stageMarks,
    presentation,
    overall,
    status,
    ranges: status === "missing" ? unpackRanges(rangesRaw) : defaultRanges()
  };
}

function trimBlankTail(members: UrlMember[]) {
  const rows = [...members];
  while (rows.length > 3 && isBlank(rows[rows.length - 1])) rows.pop();
  return rows;
}

function isBlank(member: UrlMember) {
  return !member.name.trim() && !member.stageMarks.trim() && !member.presentation.trim() && !member.overall.trim() && member.status === "present";
}

function packRanges(ranges: MissingRanges): string {
  return (["stage1", "stage2", "stage3", "presentation", "overall"] as const)
    .map((key) => `${ranges[key].min}-${ranges[key].max}`)
    .join(",");
}

function unpackRanges(value: string): MissingRanges {
  const fallback = defaultRanges();
  const keys = ["stage1", "stage2", "stage3", "presentation", "overall"] as const;
  const parts = value.split(",");
  return keys.reduce((ranges, key, index) => {
    const [min, max] = (parts[index] || "").split("-").map(Number);
    ranges[key] = {
      min: Number.isFinite(min) ? min : fallback[key].min,
      max: Number.isFinite(max) ? max : fallback[key].max
    };
    return ranges;
  }, fallback);
}

function safe(value: string) {
  return encodeURIComponent(value.trim()).replace(/%20/g, "+");
}

function unsafe(value: string) {
  return decodeURIComponent(value.replace(/\+/g, "%20"));
}
