import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  animationMode,
  defaultAccessibility,
  parseAccessibility,
  serializeAccessibility,
  themeToggleLabel,
  type AccessibilitySettings,
  type Theme
} from "./accessibility";
import { GITHUB_PROFILE_URL, MAX_MARK, MIN_MARK, MIN_TEAM_SIZE, RADHESH_RELEASED_EXAMPLE, RELEASED_GRADE_NOTE, TRUSTED_FORMULAS } from "./constants";
import {
  classifyPafFeasibility,
  csvEscape,
  formatGrade,
  individualProjectFromWeightedResult,
  inferTeamCapstone,
  pafForStudent,
  rankPafs,
  sortByPafDesc,
  stageAverage,
  teamFeasibilityNotes,
  toGradeNumber,
  validateStudentInput,
  weightedCourseResult,
  type FeasibilityLabel,
  type StudentStatus
} from "./gradeMath";
import {
  defaultRanges,
  runSimulationBatch,
  summarizeSimulationResults,
  validateMissingRanges,
  type GradeRange,
  type MissingRanges,
  type SimulationIteration,
  type SimulationStudent,
  type SimulationSummary
} from "./simulation";
import { SEED_EDITABLE, decodeUrlState, encodeUrlState, generateSeed, type UrlMember } from "./urlState";

type Member = UrlMember & { id: string; peerEvaluation?: string };

type ResultRow = {
  id: string;
  name: string;
  stageAvg: number;
  presentation: number;
  teamCapstone: number;
  individualProject: number;
  weighted: number;
  paf: number;
  feasibility: FeasibilityLabel;
  peerEvaluation?: string;
  tier?: "gold" | "silver" | "bronze";
  badge?: string;
};

const STORAGE_KEY = "courser-state-v3";
const THEME_KEY = "courser-theme";
const ACCESS_KEY = "courser-accessibility";
const URL_PREFIX = "#s=";
const LINK_LIMIT = 1800;
const CHECK_MIN_MS = 700;
const stageFields = [
  { key: "stage1", title: "Stage 1", help: "API Functionality" },
  { key: "stage2", title: "Stage 2", help: "Deployed to Cloud" },
  { key: "stage3", title: "Stage 3", help: "Scalable Application" }
] as const;
const loadingLines = [
  "The snake is checking the caps",
  "Running Vibes VAR",
  "Checking ghost teammate maths",
  "Tapping the tiny calculator",
  "Sorting PAF dots",
  "Vibes VAR review in progress"
];

let idCounter = 0;

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `m-${Date.now()}-${idCounter++}`;
}

function blankMember(): Member {
  return {
    id: makeId(),
    name: "",
    stage1: "",
    stage2: "",
    stage3: "",
    presentation: "",
    teamCapstone: "",
    individualProject: "",
    overall: "",
    status: "complete",
    ranges: defaultRanges()
  };
}

function blankSquad() {
  return [blankMember(), blankMember(), blankMember()];
}

function radheshExample(): Member[] {
  const released = RADHESH_RELEASED_EXAMPLE;
  return [
    {
      ...blankMember(),
      name: released.name,
      stage1: String(released.stage1),
      stage2: String(released.stage2),
      stage3: String(released.stage3),
      presentation: String(released.presentation),
      teamCapstone: String(released.teamCapstone),
      individualProject: String(released.individualProject),
      peerEvaluation: released.peerEvaluation
    }
  ];
}

function displayName(member: Member, index: number) {
  return member.name.trim() || `Member ${index + 1}`;
}

function storageGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function initialTheme(): Theme {
  const saved = storageGet(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initialAccess(systemReduced: boolean) {
  return parseAccessibility(storageGet(ACCESS_KEY), systemReduced);
}

function initialState() {
  const hash = location.hash.startsWith(URL_PREFIX) ? location.hash.slice(URL_PREFIX.length) : "";
  const decoded = hash ? decodeUrlState(hash) : null;
  if (decoded) return { members: normalizeMembers(decoded.members), seed: decoded.seed, notice: "Share link loaded" };
  if (hash) return { members: blankSquad(), seed: generateSeed(), notice: "Link was weird, blank squad loaded" };

  const saved = storageGet(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as { members?: UrlMember[]; seed?: string };
      return {
        members: normalizeMembers(parsed.members),
        seed: typeof parsed.seed === "string" ? parsed.seed : generateSeed(),
        notice: ""
      };
    } catch {
      return { members: blankSquad(), seed: generateSeed(), notice: "Saved data was weird, blank squad loaded" };
    }
  }

  return { members: blankSquad(), seed: generateSeed(), notice: "" };
}

function normalizeMembers(value: unknown): Member[] {
  if (!Array.isArray(value)) return blankSquad();
  const members: Member[] = value.map((raw) => {
    const item = raw && typeof raw === "object" ? (raw as Partial<Member>) : {};
    return {
      id: String(item.id || makeId()),
      name: String(item.name || ""),
      stage1: String(item.stage1 || ""),
      stage2: String(item.stage2 || ""),
      stage3: String(item.stage3 || ""),
      presentation: String(item.presentation || ""),
      teamCapstone: String(item.teamCapstone || ""),
      individualProject: String(item.individualProject || ""),
      overall: String(item.overall || ""),
      peerEvaluation: item.peerEvaluation ? String(item.peerEvaluation) : undefined,
      status: item.status === "missing" ? "missing" : "complete",
      ranges: normalizeRanges(item.ranges)
    };
  });
  return members.length ? members : blankSquad();
}

function normalizeRanges(ranges?: Partial<MissingRanges>): MissingRanges {
  const fallback = defaultRanges();
  return {
    stage1: normalizeRange(ranges?.stage1, fallback.stage1),
    stage2: normalizeRange(ranges?.stage2, fallback.stage2),
    stage3: normalizeRange(ranges?.stage3, fallback.stage3),
    presentation: normalizeRange(ranges?.presentation, fallback.presentation),
    teamCapstone: normalizeRange(ranges?.teamCapstone, fallback.teamCapstone),
    individualProject: normalizeRange(ranges?.individualProject, fallback.individualProject),
    overall: normalizeRange(ranges?.overall, fallback.overall)
  };
}

function normalizeRange(range: Partial<GradeRange> | undefined, fallback: GradeRange): GradeRange {
  const min = Number(range?.min);
  const max = Number(range?.max);
  return {
    min: Number.isFinite(min) ? min : fallback.min,
    max: Number.isFinite(max) ? max : fallback.max
  };
}

export default function App() {
  const systemReduced = useSystemReducedMotion();
  const initial = useMemo(initialState, []);
  const [members, setMembers] = useState<Member[]>(initial.members);
  const [seed, setSeed] = useState(initial.seed);
  const [notice, setNotice] = useState(initial.notice);
  const [toast, setToast] = useState<{ text: string; tone: "good" | "bad" | "info" } | null>(
    initial.notice ? { text: initial.notice, tone: "info" } : null
  );
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [access, setAccess] = useState<AccessibilitySettings>(() => initialAccess(systemReduced));
  const [accessOpen, setAccessOpen] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [logoWiggle, setLogoWiggle] = useState(false);
  const [iterations, setIterations] = useState(10000);
  const [selectedId, setSelectedId] = useState("");
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [resultVersion, setResultVersion] = useState(0);
  const [simulation, setSimulation] = useState<{
    running: boolean;
    progress: number;
    summary?: SimulationSummary;
    stale?: boolean;
    message: string;
    error?: string;
  }>({ running: false, progress: 0, message: "" });
  const cancelSimulation = useRef(false);
  const newNameRef = useRef<HTMLInputElement | null>(null);
  const toastTimer = useRef<number>();
  const reducedMotion = animationMode(access, systemReduced) === "reduced";

  const exact = useMemo(() => calculateExact(members), [members]);
  const simulationErrors = useMemo(() => validateSimulationInputs(members), [members]);
  const canRunCheck = members.length >= MIN_TEAM_SIZE && simulationErrors.length === 0 && !simulation.running && !checking;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    storageSet(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? "reduced" : "motion";
    document.documentElement.dataset.contrast = access.contrast ? "more" : "normal";
    document.documentElement.dataset.text = access.largeText ? "large" : "normal";
    document.documentElement.dataset.spacing = access.dyslexiaSpacing ? "wide" : "normal";
    storageSet(ACCESS_KEY, serializeAccessibility(access));
  }, [access, reducedMotion]);

  useEffect(() => {
    storageSet(STORAGE_KEY, JSON.stringify({ members, seed }));
  }, [members, seed]);

  useEffect(() => {
    if (!members.some((member) => member.id === selectedId)) setSelectedId(members[0]?.id || "");
  }, [members, selectedId]);

  useEffect(() => {
    if (!simulation.running || reducedMotion) return;
    const interval = window.setInterval(() => {
      setSimulation((current) => ({
        ...current,
        message: loadingLines[(loadingLines.indexOf(current.message) + 1) % loadingLines.length]
      }));
    }, 1400);
    return () => window.clearInterval(interval);
  }, [simulation.running, reducedMotion]);

  useEffect(() => {
    if (!accessOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccessOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accessOpen]);

  function showToast(text: string, tone: "good" | "bad" | "info" = "info") {
    window.clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 1500);
  }

  function announceCurrentResult() {
    if (exact.available) showToast("Results ready", "good");
    else if (members.some((member) => [member.stage1, member.stage2, member.stage3, member.presentation, member.individualProject, member.overall].some((value) => value.trim()))) {
      showToast("Fix marks first", "bad");
    }
  }

  function markCheckStale(message = "Inputs changed — run check again") {
    cancelSimulation.current = true;
    setChecked(false);
    setSimulation((current) =>
      current.running || current.summary
        ? { ...current, running: false, stale: Boolean(current.summary), message, error: undefined }
        : current
    );
    if (simulation.running || (simulation.summary && !simulation.stale)) showToast(message, "info");
  }

  function updateMember(id: string, patch: Partial<Member>) {
    markCheckStale();
    setMembers((current) => current.map((member) => (member.id === id ? { ...member, ...patch } : member)));
  }

  function updateRange(id: string, key: keyof MissingRanges, side: keyof GradeRange, value: string) {
    markCheckStale();
    setMembers((current) =>
      current.map((member) =>
        member.id === id
          ? { ...member, ranges: { ...member.ranges, [key]: { ...member.ranges[key], [side]: Number(value) } } }
          : member
      )
    );
  }

  function addMember() {
    const before = members.length;
    markCheckStale();
    setMembers((current) => [...current, blankMember()]);
    if (before < MIN_TEAM_SIZE && before + 1 >= MIN_TEAM_SIZE) showToast("The PAF snake wakes", "good");
    setLogoWiggle(true);
    window.setTimeout(() => setLogoWiggle(false), 650);
    window.setTimeout(() => newNameRef.current?.focus(), 0);
  }

  function removeMember(member: Member) {
    const hasData = [member.name, member.stage1, member.stage2, member.stage3, member.presentation, member.teamCapstone, member.individualProject, member.overall].some((value) =>
      value.trim()
    );
    if (hasData && !window.confirm(`Remove ${member.name.trim() || "this member"}?`)) return;
    markCheckStale();
    setMembers((current) => current.filter((item) => item.id !== member.id));
    if (members.length - 1 < MIN_TEAM_SIZE) showToast("Need 3 people", "bad");
  }

  function loadRadheshExample() {
    if (!window.confirm("Load Radhesh's released-grade example? This replaces the current rows.")) return;
    cancelSimulation.current = true;
    setMembers(radheshExample());
    setNotice("");
    setChecked(true);
    setResultVersion((version) => version + 1);
    setSimulation({ running: false, progress: 0, message: "" });
    showToast("Released marks loaded", "good");
  }

  function refreshSeed() {
    const next = generateSeed();
    markCheckStale();
    setSeed(next);
    showToast(`Seed: ${next}`, "info");
  }

  async function copyText(text: string, success: string, fail = "Copy failed") {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      showToast(success, "good");
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      showToast(copied ? success : fail, copied ? "good" : "bad");
    }
  }

  function copyResult() {
    if (!exact.available) {
      showToast("Fix marks first", "bad");
      return;
    }
    copyText(resultText(exact.rows), "Copied");
  }

  function exportCsv() {
    if (!exact.available) return;
    const rows = [
      ["Student", "Stage average", "Presentation", "Team capstone grade", "Individual project grade after PAF", "PAF", "Feasibility"],
      ...exact.rows.map((row) => [
        row.name,
        formatGrade(row.stageAvg),
        formatGrade(row.presentation),
        formatGrade(row.teamCapstone),
        formatGrade(row.individualProject),
        row.paf.toFixed(3),
        row.feasibility
      ])
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "courser-results.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Spreadsheet snake deployed", "good");
  }

  function copyShareLink() {
    const encoded = encodeUrlState({ members, seed });
    const url = `${location.origin}${location.pathname}${URL_PREFIX}${encoded}`;
    if (url.length > LINK_LIMIT) {
      copyText(summaryText(exact, seed), "Link got chunky. Summary copied");
      return;
    }
    copyText(url, "Share link copied");
  }

  function checkEveryone() {
    if (members.some((member) => member.status === "missing")) {
      runRealityCheck();
      return;
    }
    if (!exact.available) {
      showToast("Fix marks first", "bad");
      return;
    }
    const started = performance.now();
    setChecking(true);
    window.setTimeout(
      () => {
        setChecking(false);
        setChecked(true);
        setResultVersion((version) => version + 1);
        showToast("Results ready", "good");
      },
      Math.max(0, CHECK_MIN_MS - (performance.now() - started))
    );
  }

  function runRealityCheck() {
    if (!canRunCheck) {
      setSimulation({ running: false, progress: 0, message: "", error: simulationErrors[0] || exact.reason });
      showToast("Fix marks first", "bad");
      return;
    }
    const started = performance.now();
    const total = iterations;
    const batchSize = total >= 50000 ? 500 : 300;
    const results: SimulationIteration[] = [];
    const simStudents = members.map(toSimulationStudent);
    let invalid = 0;
    let done = 0;

    cancelSimulation.current = false;
    setChecking(true);
    setSimulation({ running: true, progress: 0, stale: false, message: reducedMotion ? "Run check" : loadingLines[0] });

    const finish = (summary: SimulationSummary) => {
      const wait = Math.max(0, CHECK_MIN_MS - (performance.now() - started));
      window.setTimeout(() => {
        setChecking(false);
        setChecked(true);
        setResultVersion((version) => version + 1);
        setSimulation({ running: false, progress: 1, summary, stale: false, message: "Vibes VAR review complete" });
        showToast("Results ready", "good");
      }, wait);
    };

    const tick = () => {
      if (cancelSimulation.current) {
        setChecking(false);
        setSimulation((current) => ({ ...current, running: false, stale: Boolean(current.summary), message: "Stop the snake" }));
        return;
      }
      const count = Math.min(batchSize, total - done);
      const batch = runSimulationBatch(simStudents, { iterations: count, seed, start: done, selectedId, enforceGradeCap: true });
      results.push(...batch.results);
      invalid += batch.invalid;
      done += count;

      if (done < total) {
        setSimulation((current) => ({ ...current, progress: done / total }));
        window.requestAnimationFrame(tick);
      } else {
        finish(summarizeSimulationResults(results, invalid, true));
      }
    };

    window.requestAnimationFrame(tick);
  }

  function stopSnake() {
    cancelSimulation.current = true;
    setChecking(false);
    setSimulation((current) => ({ ...current, running: false, stale: Boolean(current.summary), message: "Stop the snake" }));
  }

  return (
    <main className="app">
      <button className="access-button" type="button" aria-label="Accessibility settings" onClick={() => setAccessOpen(true)}>
        <AccessIcon />
      </button>
      <a className="github-button" href={GITHUB_PROFILE_URL} target="_blank" rel="noreferrer" aria-label="Open Rad’s GitHub" title="GitHub">
        <GitHubIcon />
      </a>
      {accessOpen && (
        <aside className="access-panel" aria-label="Accessibility settings">
          <div className="panel-top">
            <strong>Accessibility</strong>
            <button type="button" className="icon-button" onClick={() => setAccessOpen(false)} aria-label="Close accessibility settings">
              ×
            </button>
          </div>
          <AccessToggle label="Reduce motion" checked={access.reduceMotion} onChange={(value) => setAccess({ ...access, reduceMotion: value })} />
          <AccessToggle label="Higher contrast" checked={access.contrast} onChange={(value) => setAccess({ ...access, contrast: value })} />
          <AccessToggle label="Larger text" checked={access.largeText} onChange={(value) => setAccess({ ...access, largeText: value })} />
          <AccessToggle label="More spacing" checked={access.dyslexiaSpacing} onChange={(value) => setAccess({ ...access, dyslexiaSpacing: value })} />
          <button type="button" className="secondary" onClick={() => setAccess(defaultAccessibility(systemReduced))}>
            Reset
          </button>
        </aside>
      )}

      <header className="hero">
        <div className="brand-lockup">
          <CourserLogo className={logoWiggle ? "courser-logo wiggle" : "courser-logo"} />
          <h1>Courser</h1>
        </div>
        <ThemeToggle theme={theme} setTheme={setTheme} reducedMotion={reducedMotion} />
      </header>

      {toast && (
        <div className={`toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}
      {notice && !toast && (
        <div className="toast info" role="status" aria-live="polite">
          {notice}
        </div>
      )}

      <div className="layout">
        <section className="workbench">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Released marks</p>
                <h2>Input</h2>
              </div>
              <div className="button-row">
                <button type="button" onClick={addMember}>
                  Add person
                </button>
                <button type="button" className="secondary" onClick={loadRadheshExample}>
                  Load Radhesh example
                </button>
              </div>
            </div>
            {exact.duplicateWarning && <p className="soft-warning">{exact.duplicateWarning}</p>}
            <p className="hint help-line">Team project grade × PAF = your individual project grade</p>
            <div className="table-shell input-table-shell">
              <table className="input-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    {stageFields.map((stage) => (
                      <th key={stage.key}>
                        {stage.title}
                        <small>{stage.help}</small>
                      </th>
                    ))}
                    <th>Presentation</th>
                    <th>Team capstone</th>
                    <th>Individual project</th>
                    <th>Weighted result</th>
                    <th>Status</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, index) => (
                    <InputRow
                      key={member.id}
                      member={member}
                      index={index}
                      refTarget={index === members.length - 1 ? newNameRef : undefined}
                      touched={touched}
                      onBlur={() => {
                        announceCurrentResult();
                      }}
                      markTouched={(key) => setTouched((current) => new Set(current).add(key))}
                      updateMember={updateMember}
                      updateRange={updateRange}
                      removeMember={removeMember}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel result-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">PAF</p>
                <h2>Result</h2>
              </div>
              <div className="button-row">
                <button type="button" onClick={checkEveryone} disabled={checking || simulation.running}>
                  Check everyone
                </button>
                <button type="button" className="secondary" onClick={copyResult} disabled={!exact.available}>
                  Copy
                </button>
                <button type="button" className="secondary" onClick={exportCsv} disabled={!exact.available}>
                  Export CSV
                </button>
                <button type="button" className="secondary" onClick={copyShareLink}>
                  Copy link
                </button>
              </div>
            </div>
            {checking && <SnakeCruncher reducedMotion={reducedMotion} progress={simulation.progress} />}
            <ResultTable rows={exact.rows} version={resultVersion} reason={exact.reason} />
            {!!exact.warnings.length && (
              <ul className="warning-list">
                {exact.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel check-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">PAF Reality Check</p>
                <h2>For missing marks and ghost teammates</h2>
                <p className="hint">Use this when someone’s marks are missing. It samples likely scores and shows whether the PAF story still makes sense</p>
              </div>
              <div className="button-row">
                <button type="button" onClick={runRealityCheck} disabled={!canRunCheck}>
                  Run check
                </button>
                <button type="button" className="secondary" onClick={stopSnake} disabled={!simulation.running}>
                  Stop the snake
                </button>
              </div>
            </div>
            <div className="check-controls">
              <label>
                <span>Iterations</span>
                <select
                  value={iterations}
                  onChange={(event) => {
                    markCheckStale();
                    setIterations(Number(event.target.value));
                  }}
                >
                  <option value={1000}>1,000 quick</option>
                  <option value={10000}>10,000 sensible</option>
                  <option value={50000}>50,000 spicy</option>
                </select>
              </label>
              <label>
                <span>Selected student</span>
                <select
                  value={selectedId}
                  onChange={(event) => {
                    markCheckStale();
                    setSelectedId(event.target.value);
                  }}
                >
                  {members.map((member, index) => (
                    <option key={member.id} value={member.id}>
                      {displayName(member, index)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="seed-card" aria-label="Simulation seed">
                <span>Seed: {seed}</span>
                <button type="button" className="secondary" onClick={refreshSeed}>
                  Refresh seed
                </button>
                <small>{SEED_EDITABLE ? "" : "Locked for share links"}</small>
              </div>
            </div>
            {members.some((member) => member.status === "missing") && <p className="soft-warning">Wide ranges = spicy uncertainty</p>}
            {!!simulationErrors.length && (
              <ul className="warning-list">
                {simulationErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            {simulation.running && (
              <div className="progress-wrap" aria-live="off">
                <p>
                  {reducedMotion ? "Run check" : simulation.message}
                  <strong> {Math.round(simulation.progress * 100)}%</strong>
                </p>
                <progress value={simulation.progress} max={1} />
              </div>
            )}
            {simulation.error && <p className="status-bad">{simulation.error}</p>}
            {simulation.message && !simulation.running && <p className="hint">{simulation.message}</p>}
            {simulation.summary && !simulation.stale && <CheckResults summary={simulation.summary} />}
            {simulation.summary && simulation.stale && (
              <details className="previous-sim">
                <summary>Previous check — stale</summary>
                <p className="soft-warning">Inputs changed — run check again</p>
                <CheckResults summary={simulation.summary} stale />
              </details>
            )}
          </section>

          <section className="panel formula-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Math</p>
                <h2>Formula cards</h2>
              </div>
            </div>
            <div className="formula-grid">
              {TRUSTED_FORMULAS.map((formula) => (
                <FormulaCard key={formula.label} label={formula.label} tex={formula.tex} />
              ))}
            </div>
          </section>

          <section className="panel help-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Released grades</p>
                <h2>What PAF means</h2>
              </div>
            </div>
            <p>{shortReleasedNote()}</p>
            <details className="released-wording">
              <summary>Released wording</summary>
              <p>{RELEASED_GRADE_NOTE}</p>
            </details>
            {exact.rows.some((row) => row.peerEvaluation) && (
              <div className="released-item">
                <strong>Peer evaluation</strong>
                <span>{exact.rows.find((row) => row.peerEvaluation)?.peerEvaluation}</span>
                <small>Feedback item only, not the PAF</small>
              </div>
            )}
          </section>
        </section>

        <aside className="summary" aria-label="Quick read">
          <div className="quick-read">
            <strong>Quick read</strong>
            <SummaryLine label="Stage avg" value={exact.available ? formatGrade(exact.averageStage) : "—"} />
            <SummaryLine label="Presentation avg" value={exact.available ? formatGrade(exact.averagePresentation) : "—"} />
            <SummaryLine
              label="Team capstone"
              value={exact.available ? `${formatGrade(exact.teamCapstone, 2)}${exact.inferredTeamCapstone ? " inferred" : ""}` : "—"}
            />
            <SummaryLine label="Team size" value={String(members.length)} />
            <SummaryLine label="Highest PAF" value={exact.available ? exact.highestPaf.toFixed(2) : "—"} />
            <div className="team-read">
              <span>Team read</span>
              {(checked || exact.teamNotes.length > 0) && exact.teamNotes.length ? (
                <ul>
                  {exact.teamNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : (
                <p>{exact.available ? "The snake did the maths" : "Need 3 people"}</p>
              )}
            </div>
            {exact.releasedSummary && (
              <div className="released-summary">
                <span>Released example</span>
                <strong>{exact.releasedSummary}</strong>
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className="site-footer">
        <p>Made by Rad</p>
        <p>© 2026 Rad. All rights reserved.</p>
      </footer>
    </main>
  );
}

function InputRow({
  member,
  index,
  refTarget,
  touched,
  onBlur,
  markTouched,
  updateMember,
  updateRange,
  removeMember
}: {
  member: Member;
  index: number;
  refTarget?: RefObject<HTMLInputElement>;
  touched: Set<string>;
  onBlur: () => void;
  markTouched: (key: string) => void;
  updateMember: (id: string, patch: Partial<Member>) => void;
  updateRange: (id: string, key: keyof MissingRanges, side: keyof GradeRange, value: string) => void;
  removeMember: (member: Member) => void;
}) {
  const validation = validateStudentInput(member);
  const rangeErrors = member.status === "missing" ? validateMissingRanges(member.ranges) : [];
  const blur = (key: string) => {
    markTouched(key);
    onBlur();
  };
  return (
    <tr>
      <td>
        <Field label="Name">
          <input
            ref={refTarget}
            value={member.name}
            placeholder="e.g. Teammate 1"
            onChange={(event) => updateMember(member.id, { name: event.target.value })}
          />
        </Field>
      </td>
      {stageFields.map((stage) => (
        <td key={stage.key}>
          <NumberField
            id={`${member.id}-${stage.key}`}
            label={`${stage.title} — ${stage.help}`}
            value={member[stage.key]}
            touched={touched}
            markTouched={blur}
            onChange={(value) => updateMember(member.id, { [stage.key]: value })}
          />
          {member.status === "missing" && (
            <RangePair id={member.id} name={stage.key} label={`${stage.title} range`} range={member.ranges[stage.key]} updateRange={updateRange} />
          )}
        </td>
      ))}
      <td>
        <NumberField
          id={`${member.id}-presentation`}
          label="Presentation"
          value={member.presentation}
          touched={touched}
          markTouched={blur}
          onChange={(value) => updateMember(member.id, { presentation: value })}
        />
        {member.status === "missing" && <RangePair id={member.id} name="presentation" label="Presentation range" range={member.ranges.presentation} updateRange={updateRange} />}
      </td>
      <td>
        <OptionalNumberField
          id={`${member.id}-teamCapstone`}
          label="Team capstone"
          value={member.teamCapstone}
          touched={touched}
          markTouched={blur}
          onChange={(value) => updateMember(member.id, { teamCapstone: value })}
        />
        {member.status === "missing" && <RangePair id={member.id} name="teamCapstone" label="Team capstone range" range={member.ranges.teamCapstone} updateRange={updateRange} />}
      </td>
      <td>
        <OptionalNumberField
          id={`${member.id}-individualProject`}
          label="Individual project"
          value={member.individualProject}
          touched={touched}
          markTouched={blur}
          onChange={(value) => updateMember(member.id, { individualProject: value })}
        />
        {member.status === "missing" && (
          <RangePair id={member.id} name="individualProject" label="Individual project range" range={member.ranges.individualProject} updateRange={updateRange} />
        )}
      </td>
      <td>
        <OptionalNumberField
          id={`${member.id}-overall`}
          label="Weighted result"
          value={member.overall}
          touched={touched}
          markTouched={blur}
          onChange={(value) => updateMember(member.id, { overall: value })}
        />
        {member.status === "missing" && <RangePair id={member.id} name="overall" label="Weighted result range" range={member.ranges.overall} updateRange={updateRange} />}
      </td>
      <td>
        <Field label="Status">
          <select value={member.status} onChange={(event) => updateMember(member.id, { status: event.target.value as StudentStatus })}>
            <option value="complete">Complete</option>
            <option value="missing">Missing / unresponsive</option>
          </select>
        </Field>
        {member.status === "complete" && !validation.valid && <p className="inline-error">{validation.errors[0]}</p>}
        {!!rangeErrors.length && <p className="inline-error">{rangeErrors[0]}</p>}
      </td>
      <td>
        <button type="button" className="icon-button" aria-label={`Remove ${displayName(member, index)}`} onClick={() => removeMember(member)}>
          ×
        </button>
      </td>
    </tr>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumberField(props: {
  id: string;
  label: string;
  value: string;
  touched: Set<string>;
  markTouched: (key: string) => void;
  onChange: (value: string) => void;
}) {
  return <MarkInput {...props} optional={false} />;
}

function OptionalNumberField(props: {
  id: string;
  label: string;
  value: string;
  touched: Set<string>;
  markTouched: (key: string) => void;
  onChange: (value: string) => void;
}) {
  return <MarkInput {...props} optional />;
}

function MarkInput({
  id,
  label,
  value,
  touched,
  markTouched,
  onChange,
  optional
}: {
  id: string;
  label: string;
  value: string;
  touched: Set<string>;
  markTouched: (key: string) => void;
  onChange: (value: string) => void;
  optional: boolean;
}) {
  const invalid = optional ? value.trim() !== "" && toGradeNumber(value) === null : toGradeNumber(value) === null;
  return (
    <Field label={label}>
      <input
        className={inputClass(invalid, touched.has(id))}
        inputMode="decimal"
        value={value}
        placeholder="1–7"
        onBlur={() => markTouched(id)}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function RangePair({
  id,
  name,
  label,
  range,
  updateRange
}: {
  id: string;
  name: keyof MissingRanges;
  label: string;
  range: GradeRange;
  updateRange: (id: string, key: keyof MissingRanges, side: keyof GradeRange, value: string) => void;
}) {
  const invalid = range.min > range.max || range.min < MIN_MARK || range.max > MAX_MARK;
  const integer = name === "stage1" || name === "stage2" || name === "stage3";
  return (
    <div className="range-pair">
      <span>{label}</span>
      <label>
        <span>min</span>
        <input className={invalid ? "invalid" : ""} type="number" min={MIN_MARK} max={MAX_MARK} step={integer ? "1" : "0.1"} value={range.min} placeholder="min" onChange={(event) => updateRange(id, name, "min", event.target.value)} />
      </label>
      <label>
        <span>max</span>
        <input className={invalid ? "invalid" : ""} type="number" min={MIN_MARK} max={MAX_MARK} step={integer ? "1" : "0.1"} value={range.max} placeholder="max" onChange={(event) => updateRange(id, name, "max", event.target.value)} />
      </label>
    </div>
  );
}

function ResultTable({ rows, version, reason }: { rows: ResultRow[]; version: number; reason: string }) {
  return (
    <div className="table-shell">
      <table className="result-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Stage average</th>
            <th>Presentation</th>
            <th>Team capstone grade</th>
            <th>
              <span title="This is the project mark you personally receive after the team capstone grade is adjusted by your PAF">
                Individual project grade after PAF
              </span>
            </th>
            <th aria-sort="descending">PAF ↓</th>
            <th>Feasibility</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id} className={row.tier ? `rank-${row.tier}` : ""}>
                <th scope="row">
                  {row.name}
                  {row.badge && (
                    <span className={`rank-badge ${row.tier}`} data-pulse={version}>
                      {row.badge}
                    </span>
                  )}
                </th>
                <td title={String(row.stageAvg)}>{formatGrade(row.stageAvg)}</td>
                <td>{formatGrade(row.presentation)}</td>
                <td>{formatGrade(row.teamCapstone)}</td>
                <td title={String(row.individualProject)}>{formatGrade(row.individualProject)}</td>
                <td title={String(row.paf)}>{row.paf.toFixed(3)}</td>
                <td>
                  <span className={`feasibility ${slug(row.feasibility)}`}>{row.feasibility}</span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7}>{reason || "Need 3 people"}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CheckResults({ summary, stale = false }: { summary: SimulationSummary; stale?: boolean }) {
  return (
    <div className={stale ? "sim-results stale" : "sim-results"}>
      <p className="verdict">{stale ? `Previous: ${summary.verdict}` : summary.verdict}</p>
      <p className="hint">Estimate, not proof</p>
      <div className="metrics-grid">
        <Metric label="Valid runs" value={String(summary.valid)} />
        <Metric label="Skipped" value={String(summary.invalid)} />
        <Metric label="Team capstone median" value={formatGrade(summary.rawT.median, 4)} />
        <Metric label="Selected PAF median" value={formatGrade(summary.selectedPaf.median, 3)} />
        <Metric label="Looks plausible" value={formatPercent(summary.probabilityAllUnder13)} />
        {summary.probabilityGradeCap !== undefined && <Metric label="Inside 7" value={formatPercent(summary.probabilityGradeCap)} />}
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FormulaCard({ label, tex }: { label: string; tex: string }) {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: true, throwOnError: false }), [tex]);
  return (
    <article className="formula-card">
      <span>{label}</span>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

function ThemeToggle({ theme, setTheme, reducedMotion }: { theme: Theme; setTheme: (theme: Theme) => void; reducedMotion: boolean }) {
  return (
    <button type="button" className="theme-toggle" aria-label={themeToggleLabel(theme)} data-theme-state={theme} data-reduced={reducedMotion ? "true" : "false"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      <span className="toggle-cloud one" />
      <span className="toggle-cloud two" />
      <span className="toggle-star one" />
      <span className="toggle-star two" />
      <span className="toggle-tail" />
      <span className="toggle-orb" />
    </button>
  );
}

function CourserLogo({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 92 78" role="img" aria-label="Courser logo">
      <path className="logo-tail" d="M18 58c-11-7-1-18 9-11 8 7-2 16-10 9" fill="none" strokeWidth="5" strokeLinecap="round" />
      <path className="logo-cursor" d="M24 10l40 28-20 5 11 19-10 5-11-20-16 14z" />
      <path className="logo-kink" d="M44 24l7 9-12-1" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="logo-eye" cx="47" cy="34" r="2.2" />
    </svg>
  );
}

function SnakeCruncher({ reducedMotion, progress }: { reducedMotion: boolean; progress: number }) {
  return (
    <div className={reducedMotion ? "cruncher still" : "cruncher"} aria-hidden={reducedMotion ? "true" : "false"}>
      <div className="tile-track">
        {[1, 2, 3, 4, 5, 6, 7].map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
      <div className="math-chips">
        <span>p_i</span>
        <span>T</span>
        <span>7/7</span>
        <span>PAF</span>
      </div>
      <svg viewBox="0 0 280 76" className="accountant-snake" role="img" aria-label="Snake checking score tiles">
        <path className="accountant-tail" d="M20 49c12 16 27-9 12-15" fill="none" strokeWidth="6" strokeLinecap="round" />
        <path className="accountant-body" d="M36 45c19-17 40-17 59 0s40 17 60 0 42-17 65 1" fill="none" strokeWidth="11" strokeLinecap="round" />
        <circle className="accountant-head" cx="226" cy="46" r="13" />
        <circle className="accountant-eye" cx="230" cy="41" r="2" />
        <path className="accountant-tap" d="M214 57l-10 8" strokeWidth="4" strokeLinecap="round" />
        <rect className="tiny-calc" x="238" y="45" width="24" height="20" rx="3" />
        <path className="calc-lines" d="M243 51h14M243 57h3m5 0h3m5 0h3" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <progress value={progress || undefined} max={1} />
    </div>
  );
}

function AccessIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="4.5" r="2.2" />
      <path d="M4 9h16M12 7v13M8 20l4-8 4 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .5A11.5 11.5 0 0 0 8.36 22.9c.58.11.79-.25.79-.56v-2.02c-3.22.7-3.9-1.38-3.9-1.38-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.96.11-.75.41-1.26.74-1.55-2.57-.29-5.27-1.29-5.27-5.73 0-1.27.45-2.3 1.2-3.11-.12-.29-.52-1.47.11-3.07 0 0 .97-.31 3.18 1.19A11.1 11.1 0 0 1 12 6.03c.98 0 1.96.13 2.88.39 2.2-1.5 3.18-1.19 3.18-1.19.63 1.6.23 2.78.11 3.07.75.81 1.2 1.84 1.2 3.11 0 4.45-2.71 5.43-5.29 5.72.42.36.79 1.08.79 2.18v3.23c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5Z"
      />
    </svg>
  );
}

function AccessToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="check-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function calculateExact(members: Member[]) {
  const warnings: string[] = [];
  const duplicateWarning = duplicateNameWarning(members);
  if (duplicateWarning) warnings.push(duplicateWarning);
  const releasedExampleOnly = members.length === 1 && members[0]?.name.trim() === RADHESH_RELEASED_EXAMPLE.name;
  if (!releasedExampleOnly && members.length < MIN_TEAM_SIZE) return emptyExact("Need 3 people", warnings, duplicateWarning);
  if (members.some((member) => member.status === "missing")) return emptyExact("Exact result unavailable — run check", warnings, duplicateWarning);

  const parsed = members.map((member, index) => ({ member, index, validation: validateStudentInput(member) }));
  const invalid = parsed.find((item) => !item.validation.valid);
  if (invalid) return emptyExact(`${displayName(invalid.member, invalid.index)}: ${invalid.validation.errors[0]}`, warnings, duplicateWarning);

  const individualProjects = parsed.map(({ validation }) => validation.individualProject!);
  const knownTeamCapstones = parsed.map(({ validation }) => validation.teamCapstone).filter((value): value is number => Number.isFinite(value));
  const inferredTeamCapstone = knownTeamCapstones.length ? average(knownTeamCapstones) : inferTeamCapstone(individualProjects);
  if (!Number.isFinite(inferredTeamCapstone) || inferredTeamCapstone <= 0) return emptyExact("Need a valid team capstone grade", warnings, duplicateWarning);

  parsed.forEach(({ member, index, validation }) => {
    validation.warnings.forEach((warning) => warnings.push(`${displayName(member, index)}: ${warning}`));
  });

  const pafs = parsed.map(({ validation }) => pafForStudent(validation.individualProject!, validation.teamCapstone ?? inferredTeamCapstone));
  const ranks = rankPafs(
    parsed.map(({ member, index }, i) => ({
      id: member.id,
      name: displayName(member, index),
      paf: pafs[i]
    }))
  );
  const rows = sortByPafDesc(
    parsed.map(({ member, index, validation }, i): ResultRow => {
      const teamCapstone = validation.teamCapstone ?? inferredTeamCapstone;
      const weighted = weightedCourseResult(validation.stageAverage!, validation.presentation!, validation.individualProject!);
      return {
        id: member.id,
        name: displayName(member, index),
        stageAvg: validation.stageAverage!,
        presentation: validation.presentation!,
        teamCapstone,
        individualProject: validation.individualProject!,
        weighted,
        paf: pafs[i],
        feasibility: classifyPafFeasibility(pafs[i], pafs, members.length, validation.individualProject!, teamCapstone),
        peerEvaluation: member.peerEvaluation,
        tier: ranks[i].tier,
        badge: ranks[i].badge
      };
    })
  );

  const releasedRow = rows.find((row) => row.name === RADHESH_RELEASED_EXAMPLE.name);
  return {
    available: true,
    reason: "Results ready",
    rows,
    warnings,
    duplicateWarning,
    teamNotes: teamFeasibilityNotes(pafs, individualProjects, inferredTeamCapstone),
    teamCapstone: inferredTeamCapstone,
    inferredTeamCapstone: !knownTeamCapstones.length,
    highestPaf: Math.max(...pafs),
    averageStage: average(rows.map((row) => row.stageAvg)),
    averagePresentation: average(rows.map((row) => row.presentation)),
    releasedSummary: releasedRow ? `${releasedRow.weighted.toFixed(2)} before any course rounding` : ""
  };
}

function emptyExact(reason: string, warnings: string[] = [], duplicateWarning = "") {
  return {
    available: false,
    reason,
    rows: [] as ResultRow[],
    warnings,
    duplicateWarning,
    teamNotes: [] as string[],
    teamCapstone: NaN,
    inferredTeamCapstone: false,
    highestPaf: NaN,
    averageStage: NaN,
    averagePresentation: NaN,
    releasedSummary: ""
  };
}

function validateSimulationInputs(members: Member[]) {
  const errors: string[] = [];
  if (members.length < MIN_TEAM_SIZE) errors.push("Need 3 people");
  members.forEach((member, index) => {
    if (member.status === "complete") {
      validateStudentInput(member).errors.forEach((error) => errors.push(`${displayName(member, index)}: ${error}`));
      return;
    }
    validateMissingRanges(member.ranges).forEach((error) => errors.push(`${displayName(member, index)}: ${error}`));
  });
  return errors;
}

function toSimulationStudent(member: Member): SimulationStudent {
  return {
    id: member.id,
    name: member.name,
    status: member.status,
    stage1: member.stage1,
    stage2: member.stage2,
    stage3: member.stage3,
    presentation: member.presentation,
    teamCapstone: member.teamCapstone,
    individualProject: member.individualProject,
    overall: member.overall,
    ranges: member.ranges
  };
}

function duplicateNameWarning(members: Member[]) {
  const counts = new Map<string, number>();
  members.forEach((member) => {
    const name = member.name.trim().toLowerCase();
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  });
  return [...counts.values()].some((count) => count > 1) ? "Duplicate names are allowed, but confusing" : "";
}

function resultText(rows: ResultRow[]) {
  return [
    ["Student", "Stage average", "Presentation", "Team capstone grade", "Individual project grade after PAF", "PAF", "Feasibility"],
    ...rows.map((row) => [row.name, formatGrade(row.stageAvg), formatGrade(row.presentation), formatGrade(row.teamCapstone), formatGrade(row.individualProject), row.paf.toFixed(3), row.feasibility])
  ]
    .map((line) => line.join("\t"))
    .join("\n");
}

function summaryText(exact: ReturnType<typeof calculateExact>, seed: string) {
  return exact.available ? `Courser summary\nSeed: ${seed}\n${resultText(exact.rows)}` : `Courser summary\nSeed: ${seed}\n${exact.reason}`;
}

function shortReleasedNote() {
  return "Individual project grade comes from the team project grade, your PAF, peer feedback, staff observations, and GitHub data";
}

function average(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function inputClass(invalid: boolean, touched: boolean) {
  return invalid ? (touched ? "invalid shake" : "invalid") : "valid";
}

function formatPercent(value: number) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—";
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const listener = () => setReduced(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  return reduced;
}
