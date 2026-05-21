#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { chmod, cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "@ffprobe-installer/ffprobe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const workspaceRoot = resolve(projectRoot, "..");
const pythonCandidates = [
  process.env.DEEPFACECAM_PACKAGING_PYTHON,
  resolve(projectRoot, "build", "packaging-venv", "macos", "bin", "python"),
  resolve(workspaceRoot, "Deep-Live-Cam", ".venv", "bin", "python"),
  "python3",
].filter(Boolean);
const spec = resolve(projectRoot, "packaging", "pyinstaller", "deepfacecam_backend_macos.spec");
const workpath = resolve(projectRoot, "build", "pyinstaller", "macos");
const distpath = resolve(projectRoot, "build", "sidecar", "macos");
const generated = resolve(projectRoot, "src-tauri", "generated", "macos", "backend-sidecar");
const builtDir = resolve(distpath, "deepfacecam-backend");
const runtimeBin = resolve(projectRoot, "packaging", "pyinstaller", "runtime", "macos", "bin");

function run(cmd, args, options = {}) {
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

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyExecutable(source, targetName) {
  if (!source || !(await exists(source))) {
    throw new Error(`Runtime tool not found: ${targetName}`);
  }
  const target = resolve(runtimeBin, targetName);
  await cp(source, target, { force: true });
  await chmod(target, 0o755);
}

async function resolvePython() {
  for (const candidate of pythonCandidates) {
    if (candidate === "python3" || (await exists(candidate))) {
      return candidate;
    }
  }
  throw new Error(
    [
      "Packaging Python not found.",
      "Run `npm run packaging:python:macos` or set DEEPFACECAM_PACKAGING_PYTHON.",
      `Checked: ${pythonCandidates.join(", ")}`,
    ].join(" ")
  );
}

async function prepareRuntimeTools() {
  await rm(runtimeBin, { recursive: true, force: true });
  await mkdir(runtimeBin, { recursive: true });
  await copyExecutable(ffmpegPath, "ffmpeg");
  await copyExecutable(ffprobe.path, "ffprobe");
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("macOS sidecar can only be built on macOS.");
  }
  const python = await resolvePython();

  await prepareRuntimeTools();

  run(python, ["-m", "PyInstaller", "--version"]);

  await rm(workpath, { recursive: true, force: true });
  await rm(distpath, { recursive: true, force: true });
  await rm(generated, { recursive: true, force: true });
  await mkdir(generated, { recursive: true });

  run(python, [
    "-m",
    "PyInstaller",
    "--noconfirm",
    "--clean",
    "--workpath",
    workpath,
    "--distpath",
    distpath,
    spec,
  ]);

  await cp(builtDir, resolve(generated, "deepfacecam-backend"), {
    recursive: true,
    dereference: true,
  });

  console.log(`[sidecar:macos] wrote ${generated}`);
}

main().catch((error) => {
  console.error(`[sidecar:macos] ${error.stack || error.message}`);
  process.exit(1);
});
