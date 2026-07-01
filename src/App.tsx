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
import { MAX_MARK, MIN_MARK, MIN_TEAM_SIZE, TRUSTED_FORMULAS } from "./constants";
import {
  classifyPafFeasibility,
  cloudAverage,
  csvEscape,
  finalProjectAfterPAF,
  formatGrade,
  pafForStudent,
  parseCloudXYZ,
  rankPafs,
  rawTeamProjectBeforePAF,
  sortByPafDesc,
  teamFeasibilityNotes,
  toGradeNumber,
  validateStudentInput,
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
import {
  SEED_EDITABLE,
  decodeUrlState,
  encodeUrlState,
  generateSeed,
  type UrlMember
} from "./urlState";

type Member = UrlMember & { id: string };

type ResultRow = {
  id: string;
  name: string;
  cloud: number;
  presentation: number;
  finalProject: number;
  paf: number;
  overall: number;
  feasibility: FeasibilityLabel;
  tier?: "gold" | "silver" | "bronze";
  badge?: string;
};

const STORAGE_KEY = "courser-state-v2";
const THEME_KEY = "courser-theme";
const ACCESS_KEY = "courser-accessibility";
const URL_PREFIX = "#s=";
const LINK_LIMIT = 1800;
const loadingLines = [
  "Consulting the Bonsam Bureau...",
  "Checking whether Kane has been released from the spreadsheet curse...",
  "Running Vibes VAR...",
  "Asking the PAF witch doctor for a second opinion...",
  "Polishing the golden rim while the snake counts...",
  "Converting group project chaos into probability soup...",
  "Looking for the teammate last seen in Week 13...",
  "Hex Check in progress. No sacrifices, just TypeScript.",
  "Crunching the curse-adjusted contribution matrix...",
  "The spreadsheet snake has entered stoppage time..."
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
    cloudXYZ: "",
    presentation: "",
    overall: "",
    status: "complete",
    ranges: defaultRanges()
  };
}

function blankSquad() {
  return [blankMember(), blankMember(), blankMember()];
}

function demoSquad(): Member[] {
  return [
    makeMember("Rad", "777", "6", "7"),
    makeMember("Yes", "574", "7", "6"),
    makeMember("Dal", "755", "7", "6"),
    makeMember("Mar", "774", "6", "6"),
    makeMember("Jai", "577", "7", "7")
  ];
}

function makeMember(name: string, cloudXYZ: string, presentation: string, overall: string): Member {
  return { ...blankMember(), name, cloudXYZ, presentation, overall };
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
  if (decoded) return { members: normalizeMembers(decoded.members), seed: decoded.seed, notice: "Share link loaded." };

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
      return { members: blankSquad(), seed: generateSeed(), notice: "Saved data was busted, so Courser started fresh." };
    }
  }

  return { members: blankSquad(), seed: generateSeed(), notice: "" };
}

function normalizeMembers(value: unknown): Member[] {
  if (!Array.isArray(value)) return blankSquad();
  const members = value.map((raw) => {
    const item = raw && typeof raw === "object" ? (raw as Partial<Member>) : {};
    return {
      id: String(item.id || makeId()),
      name: String(item.name || ""),
      cloudXYZ: String(item.cloudXYZ || ""),
      presentation: String(item.presentation || ""),
      overall: String(item.overall || ""),
      status: item.status === "missing" ? "missing" : "complete",
      ranges: normalizeRanges(item.ranges)
    };
  });
  return members.length ? members : blankSquad();
}

function normalizeRanges(ranges?: Partial<MissingRanges>): MissingRanges {
  const fallback = defaultRanges();
  return {
    x: normalizeRange(ranges?.x, fallback.x),
    y: normalizeRange(ranges?.y, fallback.y),
    z: normalizeRange(ranges?.z, fallback.z),
    presentation: normalizeRange(ranges?.presentation, fallback.presentation),
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
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [access, setAccess] = useState<AccessibilitySettings>(() => initialAccess(systemReduced));
  const [accessOpen, setAccessOpen] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [logoWiggle, setLogoWiggle] = useState(false);
  const [iterations, setIterations] = useState(10000);
  const [selectedId, setSelectedId] = useState("");
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
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
  const reducedMotion = animationMode(access, systemReduced) === "reduced";

  const exact = useMemo(() => calculateExact(members), [members]);
  const simulationErrors = useMemo(() => validateSimulationInputs(members), [members]);
  const canRunHex = members.length >= MIN_TEAM_SIZE && simulationErrors.length === 0 && !simulation.running && !checking;

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

  function markHexStale(message = "Inputs changed — run Hex Check again.") {
    cancelSimulation.current = true;
    setChecked(false);
    setSimulation((current) =>
      current.running || current.summary
        ? { ...current, running: false, stale: Boolean(current.summary), message, error: undefined }
        : current
    );
    if (simulation.running || (simulation.summary && !simulation.stale)) setToast(message);
  }

  function updateMember(id: string, patch: Partial<Member>) {
    markHexStale();
    setMembers((current) => current.map((member) => (member.id === id ? { ...member, ...patch } : member)));
  }

  function updateRange(id: string, key: keyof MissingRanges, side: keyof GradeRange, value: string) {
    markHexStale();
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
    markHexStale();
    setMembers((current) => [...current, blankMember()]);
    if (before < MIN_TEAM_SIZE && before + 1 >= MIN_TEAM_SIZE) setToast("The PAF snake wakes.");
    setLogoWiggle(true);
    window.setTimeout(() => setLogoWiggle(false), 650);
    window.setTimeout(() => newNameRef.current?.focus(), 0);
  }

  function removeMember(member: Member) {
    const hasData = [member.name, member.cloudXYZ, member.presentation, member.overall].some((value) => value.trim());
    if (hasData && !window.confirm(`Remove ${member.name.trim() || "this member"}?`)) return;
    markHexStale();
    setMembers((current) => current.filter((item) => item.id !== member.id));
    if (members.length - 1 < MIN_TEAM_SIZE) setToast("Need at least 3 active members before the PAF snake wakes up.");
  }

  function loadDemoSquad() {
    if (!window.confirm("Load the demo squad? This replaces the current rows.")) return;
    cancelSimulation.current = true;
    setMembers(demoSquad());
    setNotice("");
    setChecked(false);
    setSimulation({ running: false, progress: 0, message: "" });
    setToast("Sample squad restored.");
  }

  function refreshSeed() {
    const next = generateSeed();
    markHexStale();
    setSeed(next);
    setToast(`Seed refreshed: ${next}`);
  }

  async function copyText(text: string, success: string, fail = "Copy failed. Select the text and copy it manually.") {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setToast(success);
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
      setToast(copied ? success : fail);
    }
  }

  function copyResult() {
    if (!exact.available) {
      setToast("Nothing copied — the maths goblin found errors.");
      return;
    }
    copyText(resultText(exact.rows), "PAF goblin copied it.");
  }

  function exportCsv() {
    if (!exact.available) return;
    const rows = [
      ["Student", "Final cloud grade", "Presentation grade", "Final project grade after PAF", "PAF", "Overall grade", "Feasibility"],
      ...exact.rows.map((row) => [
        row.name,
        formatGrade(row.cloud),
        formatGrade(row.presentation),
        formatGrade(row.finalProject),
        row.paf.toFixed(3),
        formatGrade(row.overall),
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
    setToast("Spreadsheet snake deployed.");
  }

  function copyShareLink() {
    const encoded = encodeUrlState({ members, seed });
    const url = `${location.origin}${location.pathname}${URL_PREFIX}${encoded}`;
    if (url.length > LINK_LIMIT) {
      copyText(summaryText(exact, seed), "Link got chunky. Copying a summary instead.");
      return;
    }
    copyText(url, "Share link copied.");
  }

  function checkEveryone() {
    if (members.some((member) => member.status === "missing")) {
      runHexCheck();
      return;
    }
    if (!exact.available) {
      setToast(exact.reason);
      return;
    }
    setChecking(true);
    setToast("The snake did the maths.");
    window.setTimeout(() => {
      setChecking(false);
      setChecked(true);
    }, reducedMotion ? 120 : 850);
  }

  function runHexCheck() {
    if (!canRunHex) {
      setSimulation({ running: false, progress: 0, message: "", error: simulationErrors[0] || exact.reason });
      return;
    }
    const total = iterations;
    const batchSize = total >= 50000 ? 500 : 300;
    const results: SimulationIteration[] = [];
    const simStudents = members.map(toSimulationStudent);
    let invalid = 0;
    let done = 0;

    cancelSimulation.current = false;
    setChecking(true);
    setSimulation({ running: true, progress: 0, stale: false, message: reducedMotion ? "Hex Check running..." : loadingLines[0] });

    const tick = () => {
      if (cancelSimulation.current) {
        setChecking(false);
        setSimulation((current) => ({ ...current, running: false, stale: Boolean(current.summary), message: "Stop the snake." }));
        return;
      }
      const count = Math.min(batchSize, total - done);
      const batch = runSimulationBatch(simStudents, {
        iterations: count,
        seed,
        start: done,
        selectedId,
        enforceGradeCap: true
      });
      results.push(...batch.results);
      invalid += batch.invalid;
      done += count;

      if (done < total) {
        setSimulation((current) => ({ ...current, progress: done / total }));
        window.requestAnimationFrame(tick);
      } else {
        const summary = summarizeSimulationResults(results, invalid, true);
        setChecking(false);
        setChecked(true);
        setSimulation({ running: false, progress: 1, summary, stale: false, message: "Vibes VAR review complete." });
      }
    };

    window.requestAnimationFrame(tick);
  }

  function stopSnake() {
    cancelSimulation.current = true;
    setChecking(false);
    setSimulation((current) => ({ ...current, running: false, stale: Boolean(current.summary), message: "Stop the snake." }));
  }

  return (
    <main className="app">
      <button className="access-button" type="button" aria-label="Accessibility settings" onClick={() => setAccessOpen(true)}>
        <AccessIcon />
      </button>
      {accessOpen && (
        <aside className="access-panel" aria-label="Accessibility settings">
          <div className="panel-top">
            <strong>Accessibility</strong>
            <button type="button" className="icon-button" onClick={() => setAccessOpen(false)} aria-label="Close accessibility settings">
              ×
            </button>
          </div>
          <AccessToggle label="Reduce motion" checked={access.reduceMotion} onChange={(value) => setAccess({ ...access, reduceMotion: value })} />
          <AccessToggle label="Increase contrast" checked={access.contrast} onChange={(value) => setAccess({ ...access, contrast: value })} />
          <AccessToggle label="Larger text" checked={access.largeText} onChange={(value) => setAccess({ ...access, largeText: value })} />
          <AccessToggle
            label="Dyslexia-friendly spacing"
            checked={access.dyslexiaSpacing}
            onChange={(value) => setAccess({ ...access, dyslexiaSpacing: value })}
          />
          <button type="button" className="secondary" onClick={() => setAccess(defaultAccessibility(systemReduced))}>
            Reset accessibility settings
          </button>
        </aside>
      )}

      <header className="hero">
        <div className="brand-lockup">
          <CourserLogo className={logoWiggle ? "courser-logo wiggle" : "courser-logo"} />
          <div>
            <p className="not-cursor">Definitely not Cursor. It has scales.</p>
            <h1>Courser</h1>
            <p>Marks in. Panic out.</p>
          </div>
        </div>
        <ThemeToggle theme={theme} setTheme={setTheme} reducedMotion={reducedMotion} />
      </header>

      {(notice || toast) && (
        <div className="toast" role="status" aria-live="polite">
          {toast || notice}
        </div>
      )}

      <div className="layout">
        <section className="workbench">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Squad</p>
                <h2>Input</h2>
              </div>
              <div className="button-row">
                <button type="button" onClick={addMember}>
                  Add person
                </button>
                <button type="button" className="secondary" onClick={loadDemoSquad}>
                  Load demo squad
                </button>
              </div>
            </div>
            {exact.duplicateWarning && <p className="soft-warning">{exact.duplicateWarning}</p>}
            <div className="table-shell input-table-shell">
              <table className="input-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Cloud XYZ</th>
                    <th>Presentation</th>
                    <th>Overall</th>
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
                <p className="eyebrow">Sorted by PAF</p>
                <h2>Result</h2>
                <p className="hint">Input order stays put. Result is sorted by PAF.</p>
                <p className="hint">Sorted by PAF, because group projects are basically wildlife documentaries.</p>
              </div>
              <div className="button-row">
                <button type="button" onClick={checkEveryone} disabled={checking || simulation.running}>
                  Check everyone
                </button>
                <button type="button" className="secondary" onClick={copyResult}>
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
            <p className={exact.available ? "status-ok" : "status-bad"} role="status" aria-live="polite">
              {exact.available ? "Exact result ready." : exact.reason}
            </p>
            {checking && <SnakeCruncher reducedMotion={reducedMotion} progress={simulation.progress} />}
            <ResultTable rows={exact.rows} />
          </section>

          <section className="panel hex-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Hex Check Arena</p>
                <h2>For missing marks and teammate mysteries.</h2>
                <p className="hint">Use Hex Check when teammates are missing marks. It samples possible ranges and estimates whether the PAF setup still works.</p>
              </div>
              <div className="button-row">
                <button type="button" onClick={runHexCheck} disabled={!canRunHex}>
                  Run Hex Check
                </button>
                <button type="button" className="secondary" onClick={stopSnake} disabled={!simulation.running}>
                  Stop the snake
                </button>
              </div>
            </div>
            <div className="hex-controls">
              <label>
                <span>Iterations</span>
                <select
                  value={iterations}
                  onChange={(event) => {
                    markHexStale();
                    setIterations(Number(event.target.value));
                  }}
                >
                  <option value={1000}>1,000: quick sniff</option>
                  <option value={10000}>10,000: sensible default</option>
                  <option value={50000}>50,000: big brain mode</option>
                </select>
              </label>
              <label>
                <span>Selected student</span>
                <select
                  value={selectedId}
                  onChange={(event) => {
                    markHexStale();
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
                <small>{SEED_EDITABLE ? "" : "Seed is locked so shared runs match."}</small>
              </div>
            </div>
            {members.some((member) => member.status === "missing") && <p className="soft-warning">Wide ranges = spicy uncertainty.</p>}
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
                  {reducedMotion ? "Hex Check running..." : simulation.message}
                  <strong> {Math.round(simulation.progress * 100)}%</strong>
                </p>
                <progress value={simulation.progress} max={1} />
              </div>
            )}
            {simulation.error && <p className="status-bad">{simulation.error}</p>}
            {simulation.message && !simulation.running && <p className="hint">{simulation.message}</p>}
            {simulation.summary && !simulation.stale && <HexResults summary={simulation.summary} />}
            {simulation.summary && simulation.stale && (
              <details className="previous-sim">
                <summary>Previous Hex Check — stale</summary>
                <p className="soft-warning">Inputs changed — run Hex Check again.</p>
                <HexResults summary={simulation.summary} stale />
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
        </section>

        <aside className="summary" aria-label="Summary">
          <SummaryCard label="Raw team project grade" value={exact.available ? formatGrade(exact.rawT, 4) : "—"} accent />
          <SummaryCard label="Team size" value={String(members.length)} />
          <SummaryCard label="Highest PAF" value={exact.available ? exact.highestPaf.toFixed(3) : "—"} />
          <SummaryCard label="Average cloud" value={exact.available ? formatGrade(exact.averageCloud) : "—"} />
          <SummaryCard label="Average presentation" value={exact.available ? formatGrade(exact.averagePresentation) : "—"} />
          <SummaryCard label="Warning count" value={String(exact.warnings.length + exact.teamNotes.length)} />
          {simulation.summary && !simulation.stale && <SummaryCard label="Hex Check" value={simulation.summary.verdict} />}
          <div className="team-read">
            <strong>Team read</strong>
            {(checked || exact.teamNotes.length > 0) && exact.teamNotes.length ? (
              <ul>
                {exact.teamNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : (
              <p>{exact.available ? "Looks balanced enough." : "Add at least 3 people and the PAF snake wakes up."}</p>
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
  markTouched,
  updateMember,
  updateRange,
  removeMember
}: {
  member: Member;
  index: number;
  refTarget?: RefObject<HTMLInputElement>;
  touched: Set<string>;
  markTouched: (key: string) => void;
  updateMember: (id: string, patch: Partial<Member>) => void;
  updateRange: (id: string, key: keyof MissingRanges, side: keyof GradeRange, value: string) => void;
  removeMember: (member: Member) => void;
}) {
  const validation = validateStudentInput(member);
  const rangeErrors = member.status === "missing" ? validateMissingRanges(member.ranges) : [];
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
      <td>
        <Field label="Cloud XYZ">
          <input
            className={inputClass(!parseCloudXYZ(member.cloudXYZ), touched.has(`${member.id}-cloud`))}
            value={member.cloudXYZ}
            placeholder="e.g. 574"
            inputMode="numeric"
            maxLength={3}
            onBlur={() => markTouched(`${member.id}-cloud`)}
            onChange={(event) => updateMember(member.id, { cloudXYZ: event.target.value })}
          />
        </Field>
        {member.status === "missing" && (
          <div className="range-stack">
            {(["x", "y", "z"] as const).map((key) => (
              <RangePair key={key} id={member.id} name={key} label={`${key.toUpperCase()} range`} range={member.ranges[key]} updateRange={updateRange} />
            ))}
          </div>
        )}
      </td>
      <td>
        <NumberField
          id={`${member.id}-presentation`}
          label="Presentation"
          value={member.presentation}
          touched={touched}
          markTouched={markTouched}
          onChange={(value) => updateMember(member.id, { presentation: value })}
        />
        {member.status === "missing" && (
          <RangePair id={member.id} name="presentation" label="Presentation range" range={member.ranges.presentation} updateRange={updateRange} />
        )}
      </td>
      <td>
        <NumberField
          id={`${member.id}-overall`}
          label="Overall"
          value={member.overall}
          touched={touched}
          markTouched={markTouched}
          onChange={(value) => updateMember(member.id, { overall: value })}
        />
        {member.status === "missing" && <RangePair id={member.id} name="overall" label="Overall range" range={member.ranges.overall} updateRange={updateRange} />}
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

function NumberField({
  id,
  label,
  value,
  touched,
  markTouched,
  onChange
}: {
  id: string;
  label: string;
  value: string;
  touched: Set<string>;
  markTouched: (key: string) => void;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        className={inputClass(toGradeNumber(value) === null, touched.has(id))}
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
  return (
    <div className="range-pair">
      <span>{label}</span>
      <label>
        <span>min</span>
        <input
          className={invalid ? "invalid" : ""}
          type="number"
          min={MIN_MARK}
          max={MAX_MARK}
          step={name === "presentation" || name === "overall" ? "0.1" : "1"}
          value={range.min}
          placeholder="min"
          onChange={(event) => updateRange(id, name, "min", event.target.value)}
        />
      </label>
      <label>
        <span>max</span>
        <input
          className={invalid ? "invalid" : ""}
          type="number"
          min={MIN_MARK}
          max={MAX_MARK}
          step={name === "presentation" || name === "overall" ? "0.1" : "1"}
          value={range.max}
          placeholder="max"
          onChange={(event) => updateRange(id, name, "max", event.target.value)}
        />
      </label>
    </div>
  );
}

function ResultTable({ rows }: { rows: ResultRow[] }) {
  return (
    <div className="table-shell">
      <table className="result-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Final cloud grade</th>
            <th>Presentation grade</th>
            <th>Final project grade after PAF</th>
            <th>PAF</th>
            <th>Overall grade</th>
            <th>Feasibility</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id} className={row.tier ? `rank-${row.tier}` : ""}>
                <th scope="row">
                  {row.name}
                  {row.badge && <span className={`rank-badge ${row.tier}`}>{row.badge}</span>}
                </th>
                <td title={String(row.cloud)}>{formatGrade(row.cloud)}</td>
                <td>{formatGrade(row.presentation)}</td>
                <td title={String(row.finalProject)}>{formatGrade(row.finalProject)}</td>
                <td title={String(row.paf)}>{row.paf.toFixed(3)}</td>
                <td>{formatGrade(row.overall)}</td>
                <td>
                  <span className={`feasibility ${slug(row.feasibility)}`}>{row.feasibility}</span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7}>Add at least 3 people and the PAF snake wakes up.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function HexResults({ summary, stale = false }: { summary: SimulationSummary; stale?: boolean }) {
  return (
    <div className={stale ? "sim-results stale" : "sim-results"}>
      <p className="verdict">{stale ? `Previous: ${summary.verdict}` : summary.verdict}</p>
      <p className="hint">Hex Check is an estimate, not proof.</p>
      <div className="metrics-grid">
        <Metric label="Valid runs" value={String(summary.valid)} />
        <Metric label="Skipped" value={String(summary.invalid)} />
        <Metric label="Raw T median" value={formatGrade(summary.rawT.median, 4)} />
        <Metric label="Raw T p10 / p90" value={`${formatGrade(summary.rawT.p10, 4)} / ${formatGrade(summary.rawT.p90, 4)}`} />
        <Metric label="Selected PAF median" value={formatGrade(summary.selectedPaf.median, 3)} />
        <Metric label="Selected PAF p10 / p90" value={`${formatGrade(summary.selectedPaf.p10, 3)} / ${formatGrade(summary.selectedPaf.p90, 3)}`} />
        <Metric label="Curse Lift Probability" value={formatPercent(summary.probabilityAllUnder13)} />
        <Metric label="Big Boost Survival" value={formatPercent(summary.probabilityAllUnder15)} />
        {summary.probabilityGradeCap !== undefined && <Metric label="Stays inside 7" value={formatPercent(summary.probabilityGradeCap)} />}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={accent ? "summary-card accent" : "summary-card"}>
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
    <button
      type="button"
      className="theme-toggle"
      aria-label={themeToggleLabel(theme)}
      data-theme-state={theme}
      data-reduced={reducedMotion ? "true" : "false"}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
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
      <svg viewBox="0 0 260 70" className="accountant-snake" role="img" aria-label="Snake accountant checking numbers">
        <path className="accountant-tail" d="M20 46c12 16 27-9 12-15" fill="none" strokeWidth="6" strokeLinecap="round" />
        <path className="accountant-body" d="M34 43c40-33 82 31 125-2 25-19 47-10 66 4" fill="none" strokeWidth="12" strokeLinecap="round" />
        <circle className="accountant-head" cx="226" cy="45" r="13" />
        <circle className="accountant-eye" cx="230" cy="40" r="2" />
        <path className="accountant-tap" d="M214 56l-8 8" strokeWidth="4" strokeLinecap="round" />
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
  if (members.length < MIN_TEAM_SIZE) return emptyExact("Need 3 people before this makes sense.", warnings, duplicateWarning);
  if (members.some((member) => member.status === "missing")) return emptyExact("Exact result unavailable — run Hex Check.", warnings, duplicateWarning);

  const parsed = members.map((member, index) => ({ member, index, validation: validateStudentInput(member) }));
  const invalid = parsed.find((item) => !item.validation.valid);
  if (invalid) return emptyExact(`${displayName(invalid.member, invalid.index)}: ${invalid.validation.errors[0]}`, warnings, duplicateWarning);

  parsed.forEach(({ member, index, validation }) => {
    validation.warnings.forEach((warning) => warnings.push(`${displayName(member, index)}: ${warning}`));
  });
  const finalProjects = parsed.map(({ validation }) => finalProjectAfterPAF(validation.overall!, validation.cloud!, validation.presentation!));
  const rawT = rawTeamProjectBeforePAF(finalProjects);
  if (!Number.isFinite(rawT) || rawT <= 0) return emptyExact("Raw team project grade is invalid because T is <= 0.", warnings, duplicateWarning);

  const pafs = finalProjects.map((project) => pafForStudent(project, rawT));
  const ranks = rankPafs(
    parsed.map(({ member, index }, i) => ({
      id: member.id,
      name: displayName(member, index),
      paf: pafs[i]
    }))
  );
  const rows = sortByPafDesc(
    parsed.map(({ member, index, validation }, i): ResultRow => ({
      id: member.id,
      name: displayName(member, index),
      cloud: validation.cloud!,
      presentation: validation.presentation!,
      finalProject: finalProjects[i],
      paf: pafs[i],
      overall: validation.overall!,
      feasibility: classifyPafFeasibility(pafs[i], pafs, members.length, finalProjects[i], rawT),
      tier: ranks[i].tier,
      badge: ranks[i].badge
    }))
  );

  return {
    available: true,
    reason: "Exact result ready.",
    rows,
    warnings,
    duplicateWarning,
    teamNotes: teamFeasibilityNotes(pafs, finalProjects, rawT),
    rawT,
    highestPaf: Math.max(...pafs),
    averageCloud: average(rows.map((row) => row.cloud)),
    averagePresentation: average(rows.map((row) => row.presentation))
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
    rawT: NaN,
    highestPaf: NaN,
    averageCloud: NaN,
    averagePresentation: NaN
  };
}

function validateSimulationInputs(members: Member[]) {
  const errors: string[] = [];
  if (members.length < MIN_TEAM_SIZE) errors.push("Need at least 3 active members before the PAF snake wakes up.");
  members.forEach((member, index) => {
    if (member.status === "complete") {
      validateStudentInput(member).errors.forEach((error) => errors.push(`${displayName(member, index)}: ${error}`));
      return;
    }
    if (member.cloudXYZ.trim() && !parseCloudXYZ(member.cloudXYZ)) errors.push(`${displayName(member, index)}: known cloud XYZ is invalid. Clear it to use ranges.`);
    if (member.presentation.trim() && toGradeNumber(member.presentation) === null) errors.push(`${displayName(member, index)}: known presentation grade is invalid. Clear it to use ranges.`);
    if (member.overall.trim() && toGradeNumber(member.overall) === null) errors.push(`${displayName(member, index)}: known overall grade is invalid. Clear it to use ranges.`);
    validateMissingRanges(member.ranges).forEach((error) => errors.push(`${displayName(member, index)}: ${error}`));
  });
  return errors;
}

function toSimulationStudent(member: Member): SimulationStudent {
  return {
    id: member.id,
    name: member.name,
    status: member.status,
    cloudXYZ: member.cloudXYZ,
    presentation: member.presentation,
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
  return [...counts.values()].some((count) => count > 1) ? "Duplicate names are allowed, but confusing." : "";
}

function resultText(rows: ResultRow[]) {
  return [
    ["Student", "Final cloud grade", "Presentation grade", "Final project grade after PAF", "PAF", "Overall grade", "Feasibility"],
    ...rows.map((row) => [row.name, formatGrade(row.cloud), formatGrade(row.presentation), formatGrade(row.finalProject), row.paf.toFixed(3), formatGrade(row.overall), row.feasibility])
  ]
    .map((line) => line.join("\t"))
    .join("\n");
}

function summaryText(exact: ReturnType<typeof calculateExact>, seed: string) {
  return exact.available ? `Courser summary\nSeed: ${seed}\n${resultText(exact.rows)}` : `Courser summary\nSeed: ${seed}\n${exact.reason}`;
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
