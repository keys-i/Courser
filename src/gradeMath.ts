import { MAX_MARK, MIN_MARK, MIN_TEAM_SIZE, VALID_STATUSES } from "./constants";

export type StudentStatus = (typeof VALID_STATUSES)[number];

export type StudentInput = {
  name?: string;
  cloudXYZ?: string;
  presentation?: string | number;
  overall?: string | number;
  status?: StudentStatus;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cloud?: number;
  presentation?: number;
  overall?: number;
};

export type RankedPaf = {
  id: string;
  name: string;
  paf: number;
  rank?: 1 | 2 | 3;
  tier?: "gold" | "silver" | "bronze";
  badge?: string;
  tied: boolean;
};

const TIE_EPSILON = 0.0001;
export type FeasibilityLabel =
  | "Impossible"
  | "Suspiciously low"
  | "Looks normal"
  | "Boosted"
  | "Very high"
  | "Needs course rule check";

export function parseCloudXYZ(value: string): [number, number, number] | null {
  const trimmed = value.trim();
  if (!/^[1-7]{3}$/.test(trimmed)) return null;
  return trimmed.split("").map(Number) as [number, number, number];
}

export function cloudAverage(value: string | readonly number[]): number {
  const digits = typeof value === "string" ? parseCloudXYZ(value) : value;
  if (!digits || digits.length !== 3) return NaN;
  return (digits[0] + digits[1] + digits[2]) / 3;
}

export function finalProjectAfterPAF(
  overall: number,
  cloudFinal: number,
  presentation: number
): number {
  return (overall - 0.4 * cloudFinal - 0.3 * presentation) / 0.3;
}

export function rawTeamProjectBeforePAF(finalProjects: readonly number[]): number {
  if (!finalProjects.length || finalProjects.some((value) => !Number.isFinite(value))) return NaN;
  return finalProjects.reduce((sum, value) => sum + value, 0) / finalProjects.length;
}

export function pafForStudent(finalProject: number, rawTeamProject: number): number {
  return rawTeamProject > 0 && Number.isFinite(rawTeamProject) ? finalProject / rawTeamProject : NaN;
}

export function capCheck(
  pafs: readonly number[],
  cap: number,
  finalProjects: readonly number[] = [],
  enforceGradeCap = false
) {
  const pafOk = pafs.every((paf) => Number.isFinite(paf) && paf >= 0 && paf <= cap);
  const gradeOk =
    !enforceGradeCap ||
    finalProjects.every((project) => Number.isFinite(project) && project >= MIN_MARK && project <= MAX_MARK);
  return {
    ok: pafOk && gradeOk,
    cap,
    maxPaf: pafs.length ? Math.max(...pafs) : NaN,
    minPaf: pafs.length ? Math.min(...pafs) : NaN,
    gradeOk
  };
}

export function rankPafs(rows: readonly { id: string; name: string; paf: number }[]): RankedPaf[] {
  const ranked = rows
    .map((row, index) => ({ ...row, index }))
    .sort((a, b) => b.paf - a.paf);
  const result = new Map<string, RankedPaf>();
  let index = 0;

  while (index < ranked.length) {
    const group = ranked.slice(index).filter((row) => Math.abs(row.paf - ranked[index].paf) <= TIE_EPSILON);
    const rank = index + 1;
    const tied = group.length > 1;
    const tier = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : undefined;
    const badge =
      rank === 1
        ? tied
          ? "Tied Top PAF"
          : "Top PAF"
        : rank === 2
          ? tied
            ? "Tied 2nd"
            : "2nd"
          : rank === 3
            ? tied
              ? "Tied 3rd"
              : "3rd"
            : undefined;

    for (const row of group) {
      result.set(row.id, {
        id: row.id,
        name: row.name,
        paf: row.paf,
        rank: rank <= 3 ? (rank as 1 | 2 | 3) : undefined,
        tier,
        badge,
        tied
      });
    }
    index += group.length;
  }

  return rows.map((row) => result.get(row.id)!);
}

export function formatGrade(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

export function validateStudentInput(student: StudentInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cloudDigits = parseCloudXYZ(String(student.cloudXYZ ?? ""));
  const presentation = toGradeNumber(student.presentation);
  const overall = toGradeNumber(student.overall);

  if (!cloudDigits) errors.push("Cloud XYZ must be exactly three digits from 1 to 7.");
  if (presentation === null) errors.push("Presentation must be a number from 1 to 7.");
  if (overall === null) errors.push("Overall must be a number from 1 to 7.");

  const cloud = cloudDigits ? cloudAverage(cloudDigits) : undefined;
  if (cloud !== undefined && presentation !== null && overall !== null) {
    const finalProject = finalProjectAfterPAF(overall, cloud, presentation);
    if (finalProject < MIN_MARK) warnings.push("Final project after PAF is below 1; that is suspicious.");
    if (finalProject > MAX_MARK) warnings.push("Final project after PAF exceeds 7 unless boosts above the normal cap are allowed.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    cloud,
    presentation: presentation ?? undefined,
    overall: overall ?? undefined
  };
}

export function toGradeNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const text = typeof value === "number" ? String(value) : String(value).trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= MIN_MARK && number <= MAX_MARK ? number : null;
}

export function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function teamSizeOk(activeCount: number): boolean {
  return activeCount >= MIN_TEAM_SIZE;
}

export function classifyPafFeasibility(
  memberPaf: number,
  allPafs: readonly number[],
  teamSize: number,
  finalProjectAfterPaf: number,
  rawTeamProject = 1
): FeasibilityLabel {
  const lowCount = allPafs.filter((paf) => paf < 0.5).length;
  if (memberPaf < 0 || rawTeamProject <= 0 || finalProjectAfterPaf < MIN_MARK) return "Impossible";
  if (memberPaf > 1.5 || finalProjectAfterPaf > MAX_MARK) return "Needs course rule check";
  if (memberPaf < 0.5 || (teamSize >= 5 && lowCount >= 3)) return "Suspiciously low";
  if (memberPaf <= 1.15) return "Looks normal";
  if (memberPaf <= 1.3) return "Boosted";
  return "Very high";
}

export function teamFeasibilityNotes(
  pafs: readonly number[],
  finalProjects: readonly number[],
  rawTeamProject: number
): string[] {
  const notes: string[] = [];
  const lowCount = pafs.filter((paf) => paf < 0.5).length;
  if (rawTeamProject <= 0 || !Number.isFinite(rawTeamProject)) notes.push("Need a valid team project grade before this makes sense.");
  if (pafs.length >= 5 && lowCount >= 3) notes.push("This distribution looks lopsided.");
  if (pafs.length === 6 && lowCount >= 5) notes.push("This is technically a number, but it smells like a group-chat incident.");
  if (pafs.some((paf) => paf > 1.5)) notes.push("Needs course rule check.");
  if (finalProjects.some((project) => project > MAX_MARK)) notes.push("Boosted above 7 — only valid if the course allows it.");
  return notes;
}

export function sortByPafDesc<T extends { paf: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.paf - a.paf);
}
