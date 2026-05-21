#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const workspaceRoot = resolve(projectRoot, "..");
const target = process.argv[2] || "macos";

const platformConfig = {
  macos: {
    platform: "darwin",
    requirements: resolve(projectRoot, "packaging", "pyinstaller", "requirements-macos.txt"),
    venv: resolve(projectRoot, "build", "packaging-venv", "macos"),
    pythonRel: ["bin", "python"],
  },
};

function run(cmd, args, options = {}) {
  console.log(`[packaging:python] ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function commandWorks(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: "ignore",
    env: process.env,
  });
  return result.status === 0;
}

function resolveBootstrapPython() {
  if (process.env.DEEPFACECAM_PACKAGING_PYTHON_BOOTSTRAP) {
    return process.env.DEEPFACECAM_PACKAGING_PYTHON_BOOTSTRAP;
  }

  for (const candidate of [
    "python3.11",
    resolve(workspaceRoot, "Deep-Live-Cam", ".venv", "bin", "python"),
    "python3",
    "python",
  ]) {
    if (commandWorks(candidate, ["--version"])) return candidate;
  }

  throw new Error(
    "No Python bootstrap executable found. Install Python 3.11 or set DEEPFACECAM_PACKAGING_PYTHON_BOOTSTRAP."
  );
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const config = platformConfig[target];
  if (!config) {
    throw new Error(`Unsupported packaging target: ${target}`);
  }
  if (process.platform !== config.platform) {
    throw new Error(`${target} packaging Python can only be prepared on ${config.platform}.`);
  }

  const bootstrapPython = resolveBootstrapPython();
  const venv = process.env.DEEPFACECAM_PACKAGING_VENV
    ? resolve(process.cwd(), process.env.DEEPFACECAM_PACKAGING_VENV)
    : config.venv;
  const python = resolve(venv, ...config.pythonRel);

  if (!(await exists(python))) {
    await mkdir(dirname(venv), { recursive: true });
    run(bootstrapPython, ["-m", "venv", venv]);
  }

  run(python, ["-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"]);
  run(python, ["-m", "pip", "install", "-r", config.requirements]);
  run(python, ["-m", "pip", "check"]);
  run(python, ["-m", "PyInstaller", "--version"]);

  if (process.env.GITHUB_ENV) {
    appendFileSync(process.env.GITHUB_ENV, `DEEPFACECAM_PACKAGING_PYTHON=${python}\n`);
  }

  console.log(`[packaging:python] DEEPFACECAM_PACKAGING_PYTHON=${python}`);
}

main().catch((error) => {
  console.error(`[packaging:python] ${error.stack || error.message}`);
  process.exit(1);
});
