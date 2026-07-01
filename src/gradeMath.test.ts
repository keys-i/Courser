import { describe, expect, it, test } from "vitest";
import { RADHESH_RELEASED_EXAMPLE, VALID_STATUSES } from "./constants";
import {
  classifyPafFeasibility,
  csvEscape,
  formatGrade,
  individualProjectFromPaf,
  individualProjectFromWeightedResult,
  inferTeamCapstone,
  pafForStudent,
  parseStageCode,
  rankPafs,
  sortByPafDesc,
  stageAverage,
  teamFeasibilityNotes,
  teamSizeOk,
  toGradeNumber,
  validateStudentInput,
  weightedCourseResult
} from "./gradeMath";

describe("grade math", () => {
  test.each([1, 1.5, 7])("accepts mark %s", (mark) => {
    expect(toGradeNumber(mark)).toBe(mark);
  });

  test.each([0, -1, 7.1, NaN, Infinity, ""])("rejects mark %s", (mark) => {
    expect(toGradeNumber(mark)).toBeNull();
  });

  test.each([
    [7, 7, 7, 7],
    [5, 7, 4, 5.333333],
    [1, 1, 1, 1]
  ])("averages stage marks", (s1, s2, s3, expected) => {
    expect(stageAverage(s1, s2, s3)).toBeCloseTo(expected, 6);
  });

  test.each([
    ["111", [1, 1, 1]],
    ["574", [5, 7, 4]],
    ["777", [7, 7, 7]]
  ])("parses compact stage code %s", (code, expected) => {
    expect(parseStageCode(code)).toEqual(expected);
  });

  test.each(["000", "057", "77", "7777", "7A7", "889", "-77"])("rejects compact stage code %s", (code) => {
    expect(parseStageCode(code)).toBeNull();
  });

  it("implements the released formulas", () => {
    const c = stageAverage(7, 7, 7);
    const i = individualProjectFromPaf(7, 1);
    expect(c).toBe(7);
    expect(i).toBe(7);
    expect(pafForStudent(i, 7)).toBe(1);
    expect(weightedCourseResult(c, 6, i)).toBeCloseTo(6.7);
    expect(individualProjectFromWeightedResult(6.7, c, 6)).toBeCloseTo(7);
  });

  it("matches the Radhesh released example without using peer evaluation as PAF", () => {
    const example = RADHESH_RELEASED_EXAMPLE;
    const c = stageAverage(example.stage1, example.stage2, example.stage3);
    expect(c).toBe(7);
    expect(pafForStudent(example.individualProject, example.teamCapstone)).toBe(1);
    expect(weightedCourseResult(c, example.presentation, example.individualProject)).toBeCloseTo(6.7);
    expect(example.peerEvaluation).toBe("1/10");
    expect(1 / 10).not.toBe(pafForStudent(example.individualProject, example.teamCapstone));
  });

  test.each([
    [-0.1, "Impossible"],
    [0, "Sus"],
    [0.49, "Sus"],
    [0.5, "Normal"],
    [1.14, "Normal"],
    [1.15, "Boosted"],
    [1.4, "Boosted"],
    [1.41, "Very high"],
    [2, "Very high"],
    [2.01, "Sus"]
  ] as const)("classifies PAF %s as %s", (paf, expected) => {
    expect(classifyPafFeasibility(paf, [paf, 1, 1], 3, 5, 5)).toBe(expected);
  });

  it("flags team-level oddities", () => {
    expect(teamFeasibilityNotes([0.4, 0.4, 0.4, 2.2, 1], [2, 2, 2, 7, 5], 5)).toContain("This looks lopsided");
    expect(teamFeasibilityNotes([0, 0.2, 0.3, 0.4, 0.49, 4.61], [1, 1, 1, 1, 1, 7], 7)).toContain(
      "This smells like a group-chat incident"
    );
    expect(teamFeasibilityNotes([1, 1, 1], [7, 8, 7], 7)).toContain("Above 7 needs course rules");
  });

  it("sorts results by PAF descending", () => {
    expect(sortByPafDesc([{ paf: 0.7 }, { paf: 1.4 }, { paf: 1.1 }]).map((row) => row.paf)).toEqual([1.4, 1.1, 0.7]);
  });

  it("ranks medals and ties without fake second place", () => {
    const ranked = rankPafs([
      { id: "a", name: "A", paf: 1.20001 },
      { id: "b", name: "B", paf: 1.2 },
      { id: "c", name: "C", paf: 1.1 },
      { id: "d", name: "D", paf: 1 }
    ]);
    expect(ranked.map((row) => row.tier)).toEqual(["gold", "gold", "bronze", undefined]);
    expect(ranked[0].badge).toBe("Tied Top PAF");
    expect(ranked[1].badge).toBe("Tied Top PAF");
    expect(ranked.some((row) => row.badge === "2nd")).toBe(false);
  });

  it("keeps every row active and requires three people for normal teams", () => {
    expect(VALID_STATUSES).toEqual(["complete", "missing"]);
    expect(teamSizeOk(2)).toBe(false);
    expect(teamSizeOk(3)).toBe(true);
  });

  it("validates input and escapes CSV", () => {
    expect(validateStudentInput({ stage1: 7, stage2: 7, stage3: 7, presentation: 6, individualProject: 7 }).valid).toBe(true);
    expect(validateStudentInput({ stage1: 0, stage2: 7, stage3: 7, presentation: 6, individualProject: 7 }).valid).toBe(false);
    expect(csvEscape('Rad, "lead"\nPAF')).toBe('"Rad, ""lead""\nPAF"');
    expect(formatGrade(inferTeamCapstone([7, 6, 5]), 4)).toBe("6.0000");
  });
});
