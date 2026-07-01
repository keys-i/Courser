import { describe, expect, it } from "vitest";
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
  { id: "rad", name: "Rad", status: "complete", cloudXYZ: "777", presentation: 6, overall: 7, ranges: defaultRanges() },
  { id: "yes", name: "Yes", status: "complete", cloudXYZ: "574", presentation: 7, overall: 6, ranges: defaultRanges() },
  {
    id: "ghost",
    name: "Ghost",
    status: "missing",
    cloudXYZ: "",
    presentation: "",
    overall: "",
    ranges: {
      x: { min: 5, max: 7 },
      y: { min: 5, max: 7 },
      z: { min: 5, max: 7 },
      presentation: { min: 6, max: 7 },
      overall: { min: 5, max: 7 }
    }
  }
];

describe("simulation", () => {
  it("is reproducible with a fixed seed", () => {
    const a = runSimulationBatch(students, { iterations: 25, seed: "fixed", selectedId: "rad" });
    const b = runSimulationBatch(students, { iterations: 25, seed: "fixed", selectedId: "rad" });
    expect(a).toEqual(b);
  });

  it("summarizes percentiles correctly", () => {
    expect(percentile([1, 2, 3, 4, 5], 10)).toBeCloseTo(1.4);
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 90)).toBeCloseTo(4.6);

    const summary = summarizeSimulationResults(
      [
        { rawT: 1, selectedPaf: 0.8, maxPaf: 1.1, minPaf: 0.8, cap13: true, cap15: true, gradeCap: true },
        { rawT: 3, selectedPaf: 1.4, maxPaf: 1.4, minPaf: 0.9, cap13: false, cap15: true, gradeCap: true }
      ],
      1
    );
    expect(summary.rawT.median).toBe(2);
    expect(summary.valid).toBe(2);
    expect(summary.invalid).toBe(1);
  });

  it("skips invalid iterations", () => {
    const invalidStudents: SimulationStudent[] = [
      { id: "a", name: "A", status: "complete", cloudXYZ: "111", presentation: 7, overall: 1, ranges: defaultRanges() },
      { id: "b", name: "B", status: "complete", cloudXYZ: "111", presentation: 7, overall: 1, ranges: defaultRanges() },
      { id: "c", name: "C", status: "complete", cloudXYZ: "111", presentation: 7, overall: 1, ranges: defaultRanges() }
    ];
    const result = runSimulationBatch(invalidStudents, { iterations: 10, seed: "bad" });
    expect(result.results).toHaveLength(0);
    expect(result.invalid).toBe(10);
  });

  it("validates missing teammate ranges", () => {
    expect(validateMissingRanges({ ...defaultRanges(), presentation: { min: 7, max: 6 } })).toEqual([
      "PRESENTATION range must stay within 1-7 and min must be <= max."
    ]);
    expect(validateMissingRanges({ ...defaultRanges(), overall: { min: 0, max: 7 } })).toEqual([
      "OVERALL range must stay within 1-7 and min must be <= max."
    ]);
  });

  it("samples cloud ranges as integers", () => {
    const value = sampleRange({ min: 5.2, max: 6.8 }, seededRandom("integer"), true);
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(6);
    expect(value).toBeLessThanOrEqual(6);
    expect(validateMissingRanges({ ...defaultRanges(), x: { min: 5.2, max: 5.8 } })).toHaveLength(1);
  });
});
