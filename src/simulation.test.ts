import { describe, expect, it, test } from "vitest";
import { refreshSeedState, generateSeed } from "./urlState";
import {
  defaultRanges,
  percentile,
  runSimulationBatch,
  sampleRange,
  seededRandom,
  summarizeSimulationResults,
  validateMissingRanges,
  type SimulationStudent
} from "./simulation";

const students: SimulationStudent[] = [
  { id: "a", name: "A", status: "complete", stage1: 7, stage2: 7, stage3: 7, presentation: 6, individualProject: 7, ranges: defaultRanges() },
  { id: "b", name: "B", status: "complete", stage1: 5, stage2: 7, stage3: 4, presentation: 7, individualProject: 6, ranges: defaultRanges() },
  { id: "c", name: "C", status: "missing", ranges: defaultRanges() }
];

describe("simulation", () => {
  it("uses readable seeds and refresh marks stale", () => {
    expect(generateSeed(() => 0)).toMatch(/^SNAKE-\d{5}$/);
    expect(refreshSeedState({ seed: "SNAKE-11111", stale: false }, () => 0.5)).toEqual({ seed: "SNAKE-55000", stale: true });
  });

  it("is deterministic for the same seed and usually changes for another", () => {
    const a = runSimulationBatch(students, { iterations: 30, seed: "SNAKE-12345", selectedId: "a" });
    const b = runSimulationBatch(students, { iterations: 30, seed: "SNAKE-12345", selectedId: "a" });
    const c = runSimulationBatch(students, { iterations: 30, seed: "SNAKE-54321", selectedId: "a" });
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });

  test.each([
    [{ ...defaultRanges(), stage1: { min: 0, max: 7 } }, "Stage 1 range must stay within 1-7 and min must be <= max."],
    [{ ...defaultRanges(), presentation: { min: 7, max: 6 } }, "Presentation range must stay within 1-7 and min must be <= max."]
  ])("validates missing ranges", (ranges, message) => {
    expect(validateMissingRanges(ranges)).toContain(message);
  });

  it("samples stage ranges as integers", () => {
    const value = sampleRange({ min: 5.2, max: 6.8 }, seededRandom("integer"), true);
    expect(value).toBe(6);
  });

  it("skips invalid iterations", () => {
    const invalid: SimulationStudent[] = [
      { id: "a", name: "A", status: "complete", stage1: 7, stage2: 7, stage3: 7, presentation: 7, overall: 1, ranges: defaultRanges() },
      { id: "b", name: "B", status: "complete", stage1: 7, stage2: 7, stage3: 7, presentation: 7, overall: 1, ranges: defaultRanges() },
      { id: "c", name: "C", status: "complete", stage1: 7, stage2: 7, stage3: 7, presentation: 7, overall: 1, ranges: defaultRanges() }
    ];
    expect(runSimulationBatch(invalid, { iterations: 5, seed: "bad" })).toEqual({ results: [], invalid: 5 });
  });

  it("summarizes runs", () => {
    expect(percentile([1, 2, 3, 4, 5], 10)).toBeCloseTo(1.4);
    const summary = summarizeSimulationResults(
      [
        { rawT: 1, selectedPaf: 0.8, maxPaf: 1.1, minPaf: 0.8, cap13: true, cap15: true, gradeCap: true },
        { rawT: 3, selectedPaf: 1.4, maxPaf: 1.4, minPaf: 0.9, cap13: false, cap15: true, gradeCap: true }
      ],
      1,
      true
    );
    expect(summary.rawT).toMatchObject({ mean: 2, median: 2, min: 1, max: 3 });
    expect(summary.rawT.p10).toBeCloseTo(1.2);
    expect(summary.rawT.p90).toBeCloseTo(2.8);
    expect(summary.valid).toBe(2);
    expect(summary.invalid).toBe(1);
  });
});
