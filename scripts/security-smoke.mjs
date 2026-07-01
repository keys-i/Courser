import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["src", ".github/workflows"];
const singleFiles = ["index.html", "vite.config.ts"];
const wanted = /\.(ts|tsx|yml|yaml)$/;

const checks = [
  {
    reason: "dynamic eval",
    pattern: /\beval\s*\(/
  },
  {
    reason: "Function constructor",
    pattern: /\bnew\s+Function\s*\(/
  },
  {
    reason: "document.write",
    pattern: /\bdocument\.write\s*\(/
  },
  {
    reason: "direct innerHTML assignment",
    pattern: /\.innerHTML\s*=/
  },
  {
    reason: "remote script over http",
    pattern: /<script[^>]+src=["']http/i
  },
  {
    reason: "protocol-relative script",
    pattern: /<script[^>]+src=["']\/\//i
  },
  {
    reason: "plain http URL in app source",
    pattern: /http:\/\//
  },
  {
    reason: "hardcoded GitHub token",
    pattern: /(ghp_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,})/
  },
  {
    reason: "console log may expose secret material",
    pattern: /console\.log\(.*(token|secret|password|key)/i
  }
];

const files = [
  ...roots.flatMap((root) => (existsSync(root) ? walk(root) : [])),
  ...singleFiles.filter((file) => existsSync(file))
].filter((file) => file === "index.html" || file === "vite.config.ts" || wanted.test(file));

const findings = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  text.split(/\r?\n/).forEach((line, index) => {
    if (allowedTrustedFormulaRender(file, line)) return;
    for (const check of checks) {
      if (check.pattern.test(line)) findings.push(`${file}:${index + 1} ${check.reason}`);
    }
    if (line.includes("dangerouslySetInnerHTML")) findings.push(`${file}:${index + 1} dangerous HTML render`);
  });
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("security smoke passed");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path;
  });
}

function allowedTrustedFormulaRender(file, line) {
  return file === "src/App.tsx" && line.includes("dangerouslySetInnerHTML={{ __html: html }}");
}
