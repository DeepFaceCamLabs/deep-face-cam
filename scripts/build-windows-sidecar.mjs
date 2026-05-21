#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { chmod, cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "@ffprobe-installer/ffprobe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const variant = process.argv[2] || process.env.DEEPFACECAM_WINDOWS_VARIANT || "cpu";
const supportedVariants = new Set(["cpu", "directml", "cuda"]);

if (!supportedVariants.has(variant)) {
  throw new Error(`Unsupported Windows sidecar variant: ${variant}`);
}

const pythonCandidates = [
  process.env.DEEPFACECAM_PACKAGING_PYTHON,
  resolve(projectRoot, "build", "packaging-venv", `windows-${variant}`, "Scripts", "python.exe"),
  resolve(projectRoot, "backend", ".venv", "Scripts", "python.exe"),
  "python",
  "py",
].filter(Boolean);
const spec = resolve(projectRoot, "packaging", "pyinstaller", "deepfacecam_backend_windows.spec");
const workpath = resolve(projectRoot, "build", "pyinstaller", `windows-${variant}`);
const distpath = resolve(projectRoot, "build", "sidecar", `windows-${variant}`);
const generated = resolve(projectRoot, "src-tauri", "generated", "windows", "backend-sidecar");
const builtDir = resolve(distpath, "deepfacecam-backend");
const runtimeBin = resolve(projectRoot, "packaging", "pyinstaller", "runtime", "windows", "bin");

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      DEEPFACECAM_WINDOWS_VARIANT: variant,
    },
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
    if (candidate === "python" || candidate === "py" || (await exists(candidate))) {
      return candidate;
    }
  }
  throw new Error(
    [
      "Packaging Python not found.",
      `Run \`npm run packaging:python:windows:${variant}\` or set DEEPFACECAM_PACKAGING_PYTHON.`,
      `Checked: ${pythonCandidates.join(", ")}`,
    ].join(" ")
  );
}

async function prepareRuntimeTools() {
  await rm(runtimeBin, { recursive: true, force: true });
  await mkdir(runtimeBin, { recursive: true });
  await copyExecutable(ffmpegPath, "ffmpeg.exe");
  await copyExecutable(ffprobe.path, "ffprobe.exe");
}

async function main() {
  if (process.platform !== "win32") {
    throw new Error("Windows sidecar can only be built on Windows.");
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
  await writeFile(resolve(generated, "variant.txt"), `${variant}\n`, "utf8");

  console.log(`[sidecar:windows] wrote ${generated} (${variant})`);
}

main().catch((error) => {
  console.error(`[sidecar:windows] ${error.stack || error.message}`);
  process.exit(1);
});
