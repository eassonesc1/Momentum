import { execSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { readFileSync } from "node:fs";

const EXPECTED_PACKAGE_NAME = "momentum";
const EXPECTED_FOLDER_NAME = "momentum";
const EXPECTED_REMOTE = "https://github.com/eassonesc1/Momentum.git";

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

const problems = [];
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

if (problems.length) {
  console.error("\nMomentum project identity check failed.");
  console.error("Stop before modifying files and confirm the project context.");
  problems.forEach((problem) => console.error(`- ${problem}`));
  console.error("");
  process.exit(1);
}
