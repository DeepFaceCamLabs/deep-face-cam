#!/usr/bin/env node

import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const backendRoot = join(projectRoot, "backend");
const manifestPath = join(projectRoot, "models", "manifest.json");
const outRoot = join(projectRoot, "src-tauri", "generated", "backend");

const excludedDirs = new Set([
  ".git",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".venv",
  "__pycache__",
  "models",
  "outputs",
  "tests",
]);

const excludedFiles = new Set([
  ".DS_Store",
  "switch_states.json",
]);

const excludedExts = new Set([
  ".log",
  ".onnx",
  ".part",
  ".pth",
  ".pt",
  ".pyc",
  ".pyo",
  ".safetensors",
  ".zip",
]);

async function copyClean(srcDir, destDir) {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = join(srcDir, entry.name);
    const dest = join(destDir, entry.name);

    if (entry.isDirectory()) {
      if (excludedDirs.has(entry.name)) continue;
      await copyClean(src, dest);
      continue;
    }

    if (!entry.isFile()) continue;
    if (excludedFiles.has(entry.name)) continue;
    if (excludedExts.has(extname(entry.name))) continue;
    await cp(src, dest);
  }
}

async function main() {
  await stat(join(backendRoot, "modules", "backend_server.py"));
  await stat(manifestPath);

  await rm(outRoot, { recursive: true, force: true });
  await copyClean(backendRoot, outRoot);
  await mkdir(join(projectRoot, "src-tauri", "generated", "macos", "backend-sidecar"), {
    recursive: true,
  });

  const outManifest = join(outRoot, "models", "manifest.json");
  await mkdir(dirname(outManifest), { recursive: true });
  await cp(manifestPath, outManifest);

  console.log(
    `[prepare-backend] ${relative(projectRoot, backendRoot)} -> ${relative(projectRoot, outRoot)}`
  );
}

main().catch((error) => {
  console.error(`[prepare-backend] ${error.stack || error.message}`);
  process.exit(1);
});
