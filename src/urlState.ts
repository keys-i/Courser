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

type ShareIndexEntry = {
  token: string;
  createdAt: number;
  teamSize?: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const SEED_EDITABLE = false;
export const SHARE_INDEX_KEY = "courser:share:index";
export const SHARE_KEY_PREFIX = "courser:share:";
export const SHARE_TOKEN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export const SHARE_TOKEN_RE = /^[2-9A-HJ-NP-Za-km-z]{6,8}$/;

export function generateSeed(random = Math.random): string {
  return `SNAKE-${Math.floor(random() * 90000 + 10000)}`;
}

export function refreshSeedState<T extends { seed: string; stale?: boolean }>(state: T, random = Math.random): T {
  return { ...state, seed: generateSeed(random), stale: true };
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

export function validShareToken(token: string): boolean {
  return SHARE_TOKEN_RE.test(token);
}

export function hashToken(hash: string): { token?: string; error?: "invalid" | "missing" } {
  const token = hash.replace(/^#/, "");
  if (!token) return {};
  return validShareToken(token) ? { token } : { error: "invalid" };
}

export function makeShareLink(origin: string, pathname: string, token: string): string {
  return `${origin}${pathname}#${token}`;
}

export function storeShareState(
  storage: StorageLike,
  state: UrlState,
  random = Math.random,
  now = Date.now
): { token: string } | null {
  try {
    const token = generateShareToken(storage, random);
    storage.setItem(`${SHARE_KEY_PREFIX}${token}`, JSON.stringify(state));
    updateIndex(storage, { token, createdAt: now(), teamSize: state.members.length });
    return { token };
  } catch {
    return null;
  }
}

export function loadShareToken(storage: StorageLike, token: string): UrlState | null {
  if (!validShareToken(token)) return null;
  try {
    const raw = storage.getItem(`${SHARE_KEY_PREFIX}${token}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isUrlState(parsed)) {
      storage.removeItem(`${SHARE_KEY_PREFIX}${token}`);
      return null;
    }
    return parsed;
  } catch {
    try {
      storage.removeItem(`${SHARE_KEY_PREFIX}${token}`);
    } catch {
      return null;
    }
    return null;
  }
}

export function loadShareHash(storage: StorageLike, hash: string): { state?: UrlState; message?: string } {
  const parsed = hashToken(hash);
  if (parsed.error === "invalid") return { state: { members: blankUrlMembers(), seed: generateSeed() }, message: "That link looks weird" };
  if (!parsed.token) return {};
  const state = loadShareToken(storage, parsed.token);
  return state
    ? { state }
    : { state: { members: blankUrlMembers(), seed: generateSeed() }, message: "Link token not found on this browser" };
}

export function generateShareToken(storage: StorageLike, random = Math.random): string {
  for (let i = 0; i < 10; i++) {
    const token = randomToken(6, random);
    if (!storage.getItem(`${SHARE_KEY_PREFIX}${token}`)) return token;
  }
  for (let i = 0; i < 10; i++) {
    const token = randomToken(8, random);
    if (!storage.getItem(`${SHARE_KEY_PREFIX}${token}`)) return token;
  }
  return randomToken(8, random);
}

function randomToken(length: number, random: () => number) {
  return Array.from({ length }, () => SHARE_TOKEN_ALPHABET[Math.floor(random() * SHARE_TOKEN_ALPHABET.length)]).join("");
}

function updateIndex(storage: StorageLike, entry: ShareIndexEntry) {
  const index = parseIndex(storage.getItem(SHARE_INDEX_KEY))
    .filter((item) => item.token !== entry.token)
    .concat(entry)
    .sort((a, b) => b.createdAt - a.createdAt);
  index.slice(25).forEach((item) => storage.removeItem(`${SHARE_KEY_PREFIX}${item.token}`));
  storage.setItem(SHARE_INDEX_KEY, JSON.stringify(index.slice(0, 25)));
}

function parseIndex(value: string | null): ShareIndexEntry[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.token === "string") : [];
  } catch {
    return [];
  }
}

function isUrlState(value: unknown): value is UrlState {
  const state = value as UrlState;
  return (
    !!state &&
    /^SNAKE-\d{5}$/.test(state.seed) &&
    Array.isArray(state.members) &&
    state.members.every(isUrlMember)
  );
}

function isUrlMember(value: unknown): value is UrlMember {
  const member = value as UrlMember;
  return (
    !!member &&
    typeof member.name === "string" &&
    typeof member.stageMarks === "string" &&
    typeof member.presentation === "string" &&
    typeof member.overall === "string" &&
    (member.status === "present" || member.status === "missing") &&
    isRanges(member.ranges)
  );
}

function isRanges(value: unknown): value is MissingRanges {
  const ranges = value as MissingRanges;
  return (
    !!ranges &&
    ["stage1", "stage2", "stage3", "presentation", "overall"].every((key) => {
      const range = ranges[key as keyof MissingRanges];
      return range && Number.isFinite(range.min) && Number.isFinite(range.max);
    })
  );
}
