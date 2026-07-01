export const MIN_MARK = 1;
export const MAX_MARK = 7;
export const MIN_TEAM_SIZE = 3;

export const VALID_STATUSES = ["present", "missing"] as const;
export const GITHUB_PROFILE_URL = "https://github.com/keys-i";

export const PAF_FACTOR_NOTE =
  "Gradebook may show it strangely, but PAF is a factor. 1.00 means 100%, so your individual project grade equals the team capstone grade.";

export const TRUSTED_FORMULAS = [
  { label: "Stage average", tex: "C = \\frac{S_1 + S_2 + S_3}{3}" },
  { label: "Individual project", tex: "I = \\frac{G - 0.40C - 0.30R}{0.30}" },
  { label: "Team capstone", tex: "T = \\operatorname{average}(I_i)" },
  { label: "PAF factor", tex: "p = \\frac{I}{T}" },
  { label: "Project relation", tex: "I = T \\times p" },
  { label: "Weighted result", tex: "G = 0.40C + 0.30R + 0.30I" },
  { label: "PAF sum", tex: "\\sum_{i=1}^{N} p_i = N" }
] as const;
