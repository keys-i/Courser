import { MAX_MARK, MIN_MARK } from "./constants";
import {
  individualProjectFromWeightedResult,
  inferTeamCapstone,
  pafForStudent,
  parseStageCode,
  stageAverage,
  toGradeNumber,
  type StudentStatus
} from "./gradeMath";

export type GradeRange = { min: number; max: number };

export type MissingRanges = {
  stage1: GradeRange;
  stage2: GradeRange;
  stage3: GradeRange;
  presentation: GradeRange;
  overall: GradeRange;
};

export type SimulationStudent = {
  id: string;
  name: string;
  status: StudentStatus;
  stageMarks?: string;
  presentation?: string | number;
  overall?: string | number;
  ranges: MissingRanges;
};

export type SimulationOptions = {
  iterations: number;
  seed: string;
  start?: number;
  selectedId?: string;
  enforceGradeCap?: boolean;
};

export type SimulationIteration = {
  rawT: number;
  selectedPaf: number;
  maxPaf: number;
  minPaf: number;
  cap13: boolean;
  cap15: boolean;
  gradeCap: boolean;
};

export type SimulationBatch = {
  results: SimulationIteration[];
  invalid: number;
};

export type StatSummary = {
  mean: number;
  median: number;
  p10: number;
  p90: number;
  min: number;
  max: number;
};

export type SimulationSummary = {
  valid: number;
  invalid: number;
  rawT: StatSummary;
  selectedPaf: StatSummary;
  probabilityAllUnder13: number;
  probabilityAllUnder15: number;
  probabilitySelectedUnder13: number;
  probabilitySelectedUnder15: number;
  probabilityGradeCap?: number;
  verdict: string;
};

export const defaultRanges = (): MissingRanges => ({
  stage1: { min: MIN_MARK, max: MAX_MARK },
  stage2: { min: MIN_MARK, max: MAX_MARK },
  stage3: { min: MIN_MARK, max: MAX_MARK },
  presentation: { min: MIN_MARK, max: MAX_MARK },
  overall: { min: MIN_MARK, max: MAX_MARK }
});

export function seededRandom(seed: string | number): () => number {
  let state = 2166136261;
  for (const char of String(seed)) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleRange(range: GradeRange, random: () => number, integer = false): number {
  if (!validRange(range)) return NaN;
  if (integer) {
    const min = Math.ceil(range.min);
    const max = Math.floor(range.max);
    return min <= max ? Math.floor(random() * (max - min + 1)) + min : NaN;
  }
  const min = Math.round(range.min * 10);
  const max = Math.round(range.max * 10);
  return (Math.floor(random() * (max - min + 1)) + min) / 10;
}

export function validRange(range: GradeRange): boolean {
  return (
    Number.isFinite(range.min) &&
    Number.isFinite(range.max) &&
    range.min >= MIN_MARK &&
    range.max <= MAX_MARK &&
    range.min <= range.max
  );
}

export function validateMissingRanges(ranges: MissingRanges): string[] {
  return (Object.entries(ranges) as [keyof MissingRanges, GradeRange][])
    .filter(
      ([key, range]) =>
        !validRange(range) ||
        (["stage1", "stage2", "stage3"].includes(key) && Math.ceil(range.min) > Math.floor(range.max))
    )
    .map(([key]) => `${rangeLabel(key)} range must stay within 1-7 and min must be <= max.`);
}

export function runSimulationBatch(students: readonly SimulationStudent[], options: SimulationOptions): SimulationBatch {
  const selectedIndex = Math.max(0, students.findIndex((student) => student.id === options.selectedId));
  const results: SimulationIteration[] = [];
  let invalid = 0;

  for (let i = 0; i < options.iterations; i++) {
    const random = seededRandom(`${options.seed}:${(options.start ?? 0) + i}`);
    const individualProjects: number[] = [];

    for (const student of students) {
      const missing = student.status === "missing";
      const stages = parseStageCode(String(student.stageMarks ?? ""));
      const stage1 = stages?.[0] ?? (missing ? sampleRange(student.ranges.stage1, random, true) : NaN);
      const stage2 = stages?.[1] ?? (missing ? sampleRange(student.ranges.stage2, random, true) : NaN);
      const stage3 = stages?.[2] ?? (missing ? sampleRange(student.ranges.stage3, random, true) : NaN);
      const presentation =
        toGradeNumber(student.presentation) ?? (missing ? sampleRange(student.ranges.presentation, random) : NaN);
      const overall = optionalMark(student.overall) ?? (missing ? sampleRange(student.ranges.overall, random) : NaN);
      const stageAvg = stageAverage(stage1, stage2, stage3);
      const individualProject = individualProjectFromWeightedResult(overall, stageAvg, presentation);

      individualProjects.push(individualProject);
    }

    const rawT = inferTeamCapstone(individualProjects);
    if (!Number.isFinite(rawT) || rawT <= 0) {
      invalid++;
      continue;
    }

    const pafs = individualProjects.map((project) => pafForStudent(project, rawT));
    if (pafs.some((paf) => !Number.isFinite(paf))) {
      invalid++;
      continue;
    }

    const nonNegative = pafs.every((paf) => paf >= 0);
    const gradeCap = !options.enforceGradeCap || individualProjects.every((project) => project >= MIN_MARK && project <= MAX_MARK);
    results.push({
      rawT,
      selectedPaf: pafs[selectedIndex] ?? pafs[0],
      maxPaf: Math.max(...pafs),
      minPaf: Math.min(...pafs),
      cap13: nonNegative && pafs.every((paf) => paf <= 1.4),
      cap15: nonNegative && pafs.every((paf) => paf <= 2),
      gradeCap
    });
  }

  return { results, invalid };
}

export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function summarizeSimulationResults(
  results: readonly SimulationIteration[],
  invalid = 0,
  enforceGradeCap = false
): SimulationSummary {
  const stat = (values: number[]): StatSummary => ({
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    median: percentile(values, 50),
    p10: percentile(values, 10),
    p90: percentile(values, 90),
    min: values.length ? Math.min(...values) : NaN,
    max: values.length ? Math.max(...values) : NaN
  });
  const valid = results.length;
  const allOkay = probability(results, (result) => result.cap13);

  return {
    valid,
    invalid,
    rawT: stat(results.map((result) => result.rawT)),
    selectedPaf: stat(results.map((result) => result.selectedPaf)),
    probabilityAllUnder13: allOkay,
    probabilityAllUnder15: probability(results, (result) => result.cap15),
    probabilitySelectedUnder13: probability(results, (result) => result.selectedPaf >= 0 && result.selectedPaf <= 1.4),
    probabilitySelectedUnder15: probability(results, (result) => result.selectedPaf >= 0 && result.selectedPaf <= 2),
    probabilityGradeCap: enforceGradeCap ? probability(results, (result) => result.gradeCap) : undefined,
    verdict: feasibilityVerdict(valid, allOkay)
  };
}

export function feasibilityVerdict(valid: number, probabilityOkay: number): string {
  if (!valid || probabilityOkay === 0) return "Course-rule check";
  if (probabilityOkay >= 0.8) return "Looks normal";
  if (probabilityOkay >= 0.45) return "Worth checking";
  return "Sus";
}

function optionalMark(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  return toGradeNumber(value) ?? NaN;
}

function probability(results: readonly SimulationIteration[], predicate: (result: SimulationIteration) => boolean): number {
  return results.length ? results.filter(predicate).length / results.length : 0;
}

function rangeLabel(key: keyof MissingRanges) {
  return key === "stage1"
    ? "Stage 1"
    : key === "stage2"
      ? "Stage 2"
      : key === "stage3"
        ? "Stage 3"
        : key[0].toUpperCase() + key.slice(1);
}
