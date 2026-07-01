export const MIN_MARK = 1;
export const MAX_MARK = 7;
export const MIN_TEAM_SIZE = 3;

export const VALID_STATUSES = ["complete", "missing"] as const;
export const GITHUB_PROFILE_URL = "https://github.com/keys-i";

export const RELEASED_GRADE_NOTE =
  "Your individual project grade is based on the team's project grade and your peer assessment factor. The peer assessment factor is based on the feedback provided by other team members, and yourself; plus observations made by staff in your practical class and data from GitHub.";

export const TRUSTED_FORMULAS = [
  { label: "Stage average", tex: "C = \\frac{S_1 + S_2 + S_3}{3}" },
  { label: "Individual project", tex: "I = T \\times p" },
  { label: "PAF estimate", tex: "p = \\frac{I}{T}" },
  { label: "Weighted result", tex: "G = 0.40C + 0.30R + 0.30I" },
  { label: "Infer individual project", tex: "I = \\frac{G - 0.40C - 0.30R}{0.30}" },
  { label: "Team inference", tex: "T = \\operatorname{average}(I_i)" },
  { label: "PAF sum", tex: "\\sum_{i=1}^{N} p_i = N" }
] as const;

export const RADHESH_RELEASED_EXAMPLE = {
  name: "Radhesh Goel",
  stage1: 7,
  stage2: 7,
  stage3: 7,
  presentation: 6,
  teamCapstone: 7,
  individualProject: 7,
  peerEvaluation: "1/10",
  weightedBeforeRounding: 6.7
} as const;
