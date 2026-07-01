import {
  StudentStatus,
  cloudAverage,
  finalProjectAfterPAF,
  pafForStudent,
  parseCloudXYZ,
  rawTeamProjectBeforePAF,
  toGradeNumber
} from "./gradeMath";
import { MAX_MARK, MIN_MARK } from "./constants";

export type GradeRange = { min: number; max: number };

export type MissingRanges = {
  x: GradeRange;
  y: GradeRange;
  z: GradeRange;
  presentation: GradeRange;
  overall: GradeRange;
};

export type SimulationStudent = {
  id: string;
  name: string;
  status: StudentStatus;
  cloudXYZ?: string;
  presentation?: string | number;
  overall?: string | number;
  ranges: MissingRanges;
};

export type SimulationOptions = {
  iterations: number;
  seed: string;
  start?: number;
  selectedId?: string;
  customCap?: number | null;
  enforceGradeCap?: boolean;
};

export type SimulationIteration = {
  rawT: number;
  selectedPaf: number;
  maxPaf: number;
  minPaf: number;
  cap13: boolean;
  cap15: boolean;
  customCap?: boolean;
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
  probabilityCustomCap?: number;
  probabilityGradeCap?: number;
  verdict: string;
};

export const defaultRanges = (): MissingRanges => ({
  x: { min: MIN_MARK, max: MAX_MARK },
  y: { min: MIN_MARK, max: MAX_MARK },
  z: { min: MIN_MARK, max: MAX_MARK },
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
    .filter(([key, range]) => !validRange(range) || (["x", "y", "z"].includes(key) && Math.ceil(range.min) > Math.floor(range.max)))
    .map(([key]) => `${key.toUpperCase()} range must stay within 1-7 and min must be <= max.`);
}

export function runSimulationBatch(students: readonly SimulationStudent[], options: SimulationOptions): SimulationBatch {
  const selectedIndex = Math.max(0, students.findIndex((student) => student.id === options.selectedId));
  const results: SimulationIteration[] = [];
  let invalid = 0;

  for (let i = 0; i < options.iterations; i++) {
    const random = seededRandom(`${options.seed}:${(options.start ?? 0) + i}`);
    const finalProjects: number[] = [];

    for (const student of students) {
      const exactCloud = parseCloudXYZ(String(student.cloudXYZ ?? ""));
      const missing = student.status === "missing";
      const cloudDigits =
        exactCloud ??
        (missing
          ? [
              sampleRange(student.ranges.x, random, true),
              sampleRange(student.ranges.y, random, true),
              sampleRange(student.ranges.z, random, true)
            ]
          : null);
      const presentation =
        toGradeNumber(student.presentation) ??
        (missing ? sampleRange(student.ranges.presentation, random) : NaN);
      const overall =
        toGradeNumber(student.overall) ?? (missing ? sampleRange(student.ranges.overall, random) : NaN);
      const cloud = cloudDigits ? cloudAverage(cloudDigits) : NaN;
      finalProjects.push(finalProjectAfterPAF(overall, cloud, presentation));
    }

    const rawT = rawTeamProjectBeforePAF(finalProjects);
    if (!Number.isFinite(rawT) || rawT <= 0) {
      invalid++;
      continue;
    }

    const pafs = finalProjects.map((project) => pafForStudent(project, rawT));
    if (pafs.some((paf) => !Number.isFinite(paf))) {
      invalid++;
      continue;
    }

    const nonNegative = pafs.every((paf) => paf >= 0);
    const gradeCap = !options.enforceGradeCap || finalProjects.every((project) => project >= MIN_MARK && project <= MAX_MARK);
    results.push({
      rawT,
      selectedPaf: pafs[selectedIndex] ?? pafs[0],
      maxPaf: Math.max(...pafs),
      minPaf: Math.min(...pafs),
      cap13: nonNegative && pafs.every((paf) => paf <= 1.3),
      cap15: nonNegative && pafs.every((paf) => paf <= 1.5),
      customCap: options.customCap ? nonNegative && pafs.every((paf) => paf <= options.customCap!) : undefined,
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
  const all13 = probability(results, (result) => result.cap13);
  const all15 = probability(results, (result) => result.cap15);

  return {
    valid,
    invalid,
    rawT: stat(results.map((result) => result.rawT)),
    selectedPaf: stat(results.map((result) => result.selectedPaf)),
    probabilityAllUnder13: all13,
    probabilityAllUnder15: all15,
    probabilitySelectedUnder13: probability(results, (result) => result.selectedPaf >= 0 && result.selectedPaf <= 1.3),
    probabilitySelectedUnder15: probability(results, (result) => result.selectedPaf >= 0 && result.selectedPaf <= 1.5),
    probabilityCustomCap:
      results.some((result) => result.customCap !== undefined) ? probability(results, (result) => result.customCap === true) : undefined,
    probabilityGradeCap: enforceGradeCap ? probability(results, (result) => result.gradeCap) : undefined,
    verdict: feasibilityVerdict(valid, all13)
  };
}

export function feasibilityVerdict(valid: number, probabilityAllUnder13: number): string {
  if (!valid || probabilityAllUnder13 === 0) return "Impossible under these ranges";
  if (probabilityAllUnder13 >= 0.8) return "Looks feasible";
  if (probabilityAllUnder13 >= 0.45) return "Borderline";
  return "Unlikely";
}

function probability(results: readonly SimulationIteration[], predicate: (result: SimulationIteration) => boolean): number {
  return results.length ? results.filter(predicate).length / results.length : 0;
}
