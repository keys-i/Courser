import { describe, expect, it } from "vitest";
import {
  capCheck,
  classifyPafFeasibility,
  cloudAverage,
  csvEscape,
  finalProjectAfterPAF,
  pafForStudent,
  parseCloudXYZ,
  rankPafs,
  rawTeamProjectBeforePAF,
  sortByPafDesc,
  teamFeasibilityNotes,
  teamSizeOk,
  validateStudentInput
} from "./gradeMath";
import { MIN_MARK, MAX_MARK, VALID_STATUSES } from "./constants";

const sample = [
  { name: "Rad", cloudXYZ: "777", presentation: 6, overall: 7 },
  { name: "Yes", cloudXYZ: "574", presentation: 7, overall: 6 },
  { name: "Dal", cloudXYZ: "755", presentation: 7, overall: 6 },
  { name: "Mar", cloudXYZ: "774", presentation: 6, overall: 6 },
  { name: "Jai", cloudXYZ: "577", presentation: 7, overall: 7 }
];

function sampleProjects() {
  return sample.map((student) =>
    finalProjectAfterPAF(student.overall, cloudAverage(student.cloudXYZ), student.presentation)
  );
}

describe("grade math", () => {
  it("parses cloud XYZ and averages it", () => {
    expect(parseCloudXYZ("777")).toEqual([7, 7, 7]);
    expect(parseCloudXYZ("111")).toEqual([1, 1, 1]);
    expect(cloudAverage("777")).toBe(7);
    expect(cloudAverage("574")).toBeCloseTo(5.333333, 6);
  });

  it("rejects invalid XYZ values", () => {
    for (const value of ["000", "057", "77", "7777", "7A7", "889", "-77"]) {
      expect(parseCloudXYZ(value)).toBeNull();
    }
  });

  it("keeps marks on an immutable one-to-seven scale", () => {
    expect(MIN_MARK).toBe(1);
    expect(MAX_MARK).toBe(7);
    expect(validateStudentInput({ cloudXYZ: "111", presentation: 1, overall: 7 }).valid).toBe(true);
    expect(validateStudentInput({ cloudXYZ: "111", presentation: 0, overall: 7 }).valid).toBe(false);
    expect(validateStudentInput({ cloudXYZ: "111", presentation: 1, overall: 0 }).valid).toBe(false);
  });

  it("does not expose an excluded status", () => {
    expect(VALID_STATUSES).toEqual(["complete", "missing"]);
    expect(VALID_STATUSES).not.toContain("excluded");
  });

  it("computes Rad's final project after PAF", () => {
    expect(finalProjectAfterPAF(7, cloudAverage("777"), 6)).toBeCloseTo(8, 6);
  });

  it("computes sample raw T and Rad PAF", () => {
    const projects = sampleProjects();
    const rawT = rawTeamProjectBeforePAF(projects);
    expect(rawT).toBeCloseTo(6.6444, 4);
    expect(pafForStudent(projects[0], rawT)).toBeCloseTo(1.204, 3);
  });

  it("keeps the PAF sum equal to active team size", () => {
    const projects = sampleProjects();
    const rawT = rawTeamProjectBeforePAF(projects);
    const pafSum = projects.reduce((sum, project) => sum + pafForStudent(project, rawT), 0);
    expect(pafSum).toBeCloseTo(sample.length, 10);
  });

  it("checks caps under 1.3 and 1.5", () => {
    const projects = sampleProjects();
    const rawT = rawTeamProjectBeforePAF(projects);
    const pafs = projects.map((project) => pafForStudent(project, rawT));
    expect(capCheck(pafs, 1.3).ok).toBe(true);
    expect(capCheck(pafs, 1.5).ok).toBe(true);
  });

  it("ranks gold, silver, and bronze PAFs", () => {
    const ranked = rankPafs([
      { id: "a", name: "A", paf: 1.4 },
      { id: "b", name: "B", paf: 1.2 },
      { id: "c", name: "C", paf: 1.1 },
      { id: "d", name: "D", paf: 1.0 }
    ]);
    expect(ranked.map((row) => row.tier)).toEqual(["gold", "silver", "bronze", undefined]);
    expect(ranked[0].badge).toBe("Top PAF");
  });

  it("handles tied PAF rankings", () => {
    const ranked = rankPafs([
      { id: "a", name: "A", paf: 1.20001 },
      { id: "b", name: "B", paf: 1.2 },
      { id: "c", name: "C", paf: 1.1 }
    ]);
    expect(ranked[0].badge).toBe("Tied Top PAF");
    expect(ranked[1].badge).toBe("Tied Top PAF");
    expect(ranked[2].tier).toBe("bronze");
  });

  it("blocks teams below three active members and rejects nonpositive T", () => {
    expect(teamSizeOk(2)).toBe(false);
    expect(teamSizeOk(3)).toBe(true);
    expect(rawTeamProjectBeforePAF([-1, -2])).toBeLessThanOrEqual(0);
  });

  it("escapes CSV safely", () => {
    expect(csvEscape('Rad, "the lead"\nPAF')).toBe('"Rad, ""the lead""\nPAF"');
  });

  it("does not treat whitespace-only grades as zero", () => {
    expect(validateStudentInput({ cloudXYZ: "777", presentation: " ", overall: "7" }).valid).toBe(false);
  });

  it("sorts result rows by PAF descending", () => {
    expect(sortByPafDesc([{ paf: 0.7 }, { paf: 1.4 }, { paf: 1.1 }]).map((row) => row.paf)).toEqual([1.4, 1.1, 0.7]);
  });

  it("classifies row feasibility", () => {
    expect(classifyPafFeasibility(-0.1, [-0.1, 1], 3, 4)).toBe("Impossible");
    expect(classifyPafFeasibility(0.4, [0.4, 1.2, 1.4], 3, 4)).toBe("Suspiciously low");
    expect(classifyPafFeasibility(1.0, [1, 1, 1], 3, 4)).toBe("Looks normal");
    expect(classifyPafFeasibility(1.2, [1.2, 0.9, 0.9], 3, 4)).toBe("Boosted");
    expect(classifyPafFeasibility(1.4, [1.4, 0.8, 0.8], 3, 4)).toBe("Very high");
    expect(classifyPafFeasibility(1.6, [1.6, 0.7, 0.7], 3, 4)).toBe("Needs course rule check");
    expect(classifyPafFeasibility(1.1, [1.1, 0.9, 1], 3, 8)).toBe("Needs course rule check");
  });

  it("flags team-level suspicious PAF patterns", () => {
    expect(teamFeasibilityNotes([0.4, 0.4, 0.4, 1.9, 1.9], [2, 2, 2, 8, 8], 4)).toContain("This distribution looks lopsided.");
    expect(teamFeasibilityNotes([0.1, 0.2, 0.3, 0.4, 0.49, 4.51], [1, 1, 1, 1, 1, 9], 4)).toContain(
      "This is technically a number, but it smells like a group-chat incident."
    );
  });
});
