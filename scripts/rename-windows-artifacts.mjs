#!/usr/bin/env node

import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "../package.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const variant = process.argv[2] || process.env.DEEPFACECAM_WINDOWS_VARIANT || "cpu";
const arch = process.arch === "x64" ? "x64" : process.arch;
const bundleRoot = resolve(projectRoot, "src-tauri", "target", "release", "bundle");
const bundles = new Set(
  (process.env.DEEPFACECAM_WINDOWS_BUNDLES || "msi")
    .split(",")
    .map((bundle) => bundle.trim())
    .filter(Boolean),
);

const variants = new Set(["cpu", "directml", "cuda"]);
if (!variants.has(variant)) {
  throw new Error(`Unsupported Windows artifact variant: ${variant}`);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function moveArtifact(source, target) {
  if (source === target) return;
  if (!(await exists(source))) {
    if (await exists(target)) {
      console.log(`[rename:windows] already renamed ${target}`);
      return;
    }
    throw new Error(`Expected artifact not found: ${source}`);
  }
  await mkdir(dirname(target), { recursive: true });
  await rm(target, { force: true });
  await rename(source, target);
  console.log(`[rename:windows] ${source} -> ${target}`);
}

if (bundles.has("nsis")) {
  await moveArtifact(
    resolve(bundleRoot, "nsis", `DeepFaceCam_${pkg.version}_x64-setup.exe`),
    resolve(bundleRoot, "nsis", `DeepFaceCam_${pkg.version}_windows_${variant}_${arch}_setup.exe`),
  );
} else {
  console.log("[rename:windows] skipping NSIS artifact rename");
}

if (bundles.has("msi")) {
  await moveArtifact(
    resolve(bundleRoot, "msi", `DeepFaceCam_${pkg.version}_x64_en-US.msi`),
    resolve(bundleRoot, "msi", `DeepFaceCam_${pkg.version}_windows_${variant}_${arch}_en-US.msi`),
  );
} else {
  console.log("[rename:windows] skipping MSI artifact rename");
}
