export const MIN_MARK = 1;
export const MAX_MARK = 7;
export const MIN_TEAM_SIZE = 3;

export const VALID_STATUSES = ["complete", "missing"] as const;

export const TRUSTED_FORMULAS = [
  { label: "Cloud", tex: "C = \\frac{X + Y + Z}{3}" },
  { label: "Overall", tex: "G = 0.40C + 0.30P + 0.30F" },
  { label: "Project", tex: "F = \\frac{G - 0.40C - 0.30P}{0.30}" },
  { label: "Team grade", tex: "T = \\operatorname{average}(F_i)" },
  { label: "PAF", tex: "p_i = \\frac{F_i}{T}" },
  { label: "PAF sum", tex: "\\sum_{i=1}^{N} p_i = N" }
] as const;
