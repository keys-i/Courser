import { MAX_MARK, MIN_MARK, MIN_TEAM_SIZE, VALID_STATUSES } from "./constants";

export type StudentStatus = (typeof VALID_STATUSES)[number];

export type StudentInput = {
  name?: string;
  stage1?: string | number;
  stage2?: string | number;
  stage3?: string | number;
  presentation?: string | number;
  teamCapstone?: string | number;
  individualProject?: string | number;
  overall?: string | number;
  status?: StudentStatus;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stageAverage?: number;
  presentation?: number;
  teamCapstone?: number;
  individualProject?: number;
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

export type FeasibilityLabel = "Normal" | "Boosted" | "High" | "Sus" | "Course-rule check";

const TIE_EPSILON = 0.0001;

export function parseStageCode(value: string): [number, number, number] | null {
  const trimmed = value.trim();
  if (!/^[1-7]{3}$/.test(trimmed)) return null;
  return trimmed.split("").map(Number) as [number, number, number];
}

export function stageAverage(stage1: number, stage2: number, stage3: number): number {
  return (stage1 + stage2 + stage3) / 3;
}

export function weightedCourseResult(stageAvg: number, presentation: number, individualProject: number): number {
  return 0.4 * stageAvg + 0.3 * presentation + 0.3 * individualProject;
}

export function individualProjectFromWeightedResult(overall: number, stageAvg: number, presentation: number): number {
  return (overall - 0.4 * stageAvg - 0.3 * presentation) / 0.3;
}

export function individualProjectFromPaf(teamCapstone: number, paf: number): number {
  return teamCapstone * paf;
}

export function pafForStudent(individualProject: number, teamCapstone: number): number {
  return teamCapstone > 0 && Number.isFinite(teamCapstone) ? individualProject / teamCapstone : NaN;
}

export function inferTeamCapstone(individualProjects: readonly number[]): number {
  if (!individualProjects.length || individualProjects.some((value) => !Number.isFinite(value))) return NaN;
  return individualProjects.reduce((sum, value) => sum + value, 0) / individualProjects.length;
}

export const rawTeamProjectBeforePAF = inferTeamCapstone;
export const finalProjectAfterPAF = individualProjectFromWeightedResult;

export function capCheck(
  pafs: readonly number[],
  cap: number,
  individualProjects: readonly number[] = [],
  enforceGradeCap = false
) {
  const pafOk = pafs.every((paf) => Number.isFinite(paf) && paf >= 0 && paf <= cap);
  const gradeOk =
    !enforceGradeCap ||
    individualProjects.every((project) => Number.isFinite(project) && project >= MIN_MARK && project <= MAX_MARK);
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
  const stage1 = toGradeNumber(student.stage1);
  const stage2 = toGradeNumber(student.stage2);
  const stage3 = toGradeNumber(student.stage3);
  const presentation = toGradeNumber(student.presentation);
  const teamCapstone = optionalGradeNumber(student.teamCapstone);
  const directIndividual = optionalGradeNumber(student.individualProject);
  const overall = optionalGradeNumber(student.overall);

  if (stage1 === null) errors.push("Stage 1 must be a number from 1 to 7.");
  if (stage2 === null) errors.push("Stage 2 must be a number from 1 to 7.");
  if (stage3 === null) errors.push("Stage 3 must be a number from 1 to 7.");
  if (presentation === null) errors.push("Presentation must be a number from 1 to 7.");
  if (teamCapstone === null) errors.push("Team capstone must be blank or a number from 1 to 7.");
  if (directIndividual === null) errors.push("Individual project must be blank or a number from 1 to 7.");
  if (overall === null) errors.push("Weighted result must be blank or a number from 1 to 7.");
  if (directIndividual === undefined && overall === undefined) errors.push("Add individual project grade or weighted result.");

  const average = stage1 !== null && stage2 !== null && stage3 !== null ? stageAverage(stage1, stage2, stage3) : undefined;
  const individualProject =
    directIndividual !== null && directIndividual !== undefined
      ? directIndividual
      : overall !== null && overall !== undefined && average !== undefined && presentation !== null
      ? individualProjectFromWeightedResult(overall, average, presentation)
      : undefined;

  if (individualProject !== undefined) {
    if (individualProject < MIN_MARK) warnings.push("Individual project after PAF is below 1.");
    if (individualProject > MAX_MARK) warnings.push("Above 7 needs course rules.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stageAverage: average,
    presentation: presentation ?? undefined,
    teamCapstone: teamCapstone ?? undefined,
    individualProject,
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

export function optionalGradeNumber(value: unknown): number | null | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  return toGradeNumber(value);
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
  individualProject: number,
  teamCapstone = 1
): FeasibilityLabel {
  if (teamCapstone <= 0 || individualProject < MIN_MARK) return "Course-rule check";
  if (individualProject > MAX_MARK) return "Course-rule check";
  if (memberPaf > 2) return "Sus";
  if (memberPaf < 0.5) return "Sus";
  if (teamSize === 6 && allPafs.filter((paf) => paf < 0.5).length >= 5) return "Sus";
  if (memberPaf < 1.15) return "Normal";
  if (memberPaf <= 1.4) return "Boosted";
  return "High";
}

export function teamFeasibilityNotes(
  pafs: readonly number[],
  individualProjects: readonly number[],
  teamCapstone: number
): string[] {
  const notes: string[] = [];
  const lowCount = pafs.filter((paf) => paf < 0.5).length;
  if (teamCapstone <= 0 || !Number.isFinite(teamCapstone)) notes.push("Need a valid team capstone grade");
  if (pafs.some((paf) => paf > 2) && lowCount >= Math.max(1, pafs.length - 2)) notes.push("A bit lopsided");
  if (pafs.length === 6 && lowCount >= 5) notes.push("This smells like a group-chat incident");
  if (individualProjects.some((project) => project > MAX_MARK)) notes.push("Above 7 needs course rules");
  return notes;
}

export function sortByPafDesc<T extends { paf: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.paf - a.paf);
}
