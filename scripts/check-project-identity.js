import { execSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { readdirSync, readFileSync, statSync } from "node:fs";

const EXPECTED_PACKAGE_NAME = "momentum";
const EXPECTED_FOLDER_NAME = "momentum";
const EXPECTED_REMOTE = "https://github.com/eassonesc1/Momentum.git";
const FORBIDDEN_TERMS = [
  ["Qua", "naomei"].join(""),
  ["qua", "naomei", "-", "website"].join(""),
  ["全", "奥", "美"].join(""),
  ["Pam", "pers"].join(""),
];
const FORBIDDEN_PATTERN = new RegExp(FORBIDDEN_TERMS.join("|"), "i");
const IGNORED_DIRS = new Set([".git", "dist", "node_modules", ".npm-cache"]);
const SOURCE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".ts",
  ".tsx",
  ".jsx",
  ".svg",
]);

function readJSON(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function run(command) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function extensionOf(fileName) {
  const index = fileName.lastIndexOf(".");
  return index === -1 ? "" : fileName.slice(index);
}

function findForbiddenReferences(directory = ".") {
  const matches = [];

  for (const entry of readdirSync(directory)) {
    if (IGNORED_DIRS.has(entry)) {
      continue;
    }

    const path = `${directory}/${entry}`;
    const stats = statSync(path);

    if (stats.isDirectory()) {
      matches.push(...findForbiddenReferences(path));
      continue;
    }

    if (!stats.isFile() || !SOURCE_EXTENSIONS.has(extensionOf(entry))) {
      continue;
    }

    const content = readFileSync(path, "utf8");

    if (FORBIDDEN_PATTERN.test(content)) {
      matches.push(path.replace(/^\.\//, ""));
    }
  }

  return matches;
}

const isCi = Boolean(process.env.VERCEL || process.env.CI);
const problems = [];
const forbiddenReferences = findForbiddenReferences();
const packageJson = readJSON("package.json");
const folderName = basename(resolve(process.cwd()));
const remoteNames = run("git remote").split(/\s+/).filter(Boolean);
const originUrl = run("git remote get-url origin");

if (packageJson?.name !== EXPECTED_PACKAGE_NAME) {
  problems.push(
    `package name is "${packageJson?.name || "missing"}"; expected "${EXPECTED_PACKAGE_NAME}"`,
  );
}

if (folderName !== EXPECTED_FOLDER_NAME) {
  problems.push(`project folder is "${folderName}"; expected "${EXPECTED_FOLDER_NAME}"`);
}

if (remoteNames.length !== 1 || remoteNames[0] !== "origin") {
  problems.push(`git remotes are "${remoteNames.join(", ") || "missing"}"; expected only "origin"`);
}

if (originUrl !== EXPECTED_REMOTE) {
  problems.push(`origin remote is "${originUrl || "missing"}"; expected "${EXPECTED_REMOTE}"`);
}

if (forbiddenReferences.length) {
  console.error("\nMomentum project identity check failed.");
  console.error("Forbidden cross-project references were found:");
  forbiddenReferences.forEach((file) => console.error(`- ${file}`));
  console.error("");
  process.exit(1);
}

if (problems.length) {
  const lines = [
    "",
    isCi
      ? "Momentum project identity warning."
      : "Momentum project identity check failed.",
    isCi
      ? "Vercel/CI builds may not include local folder or Git remote metadata."
      : "Stop before modifying files and confirm the project context.",
    ...problems.map((problem) => `- ${problem}`),
    "",
  ];

  if (isCi) {
    console.warn(lines.join("\n"));
  } else {
    console.error(lines.join("\n"));
    process.exit(1);
  }
}
