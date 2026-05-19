#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cp, mkdir, rm, symlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "../package.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const appDir = resolve(
  projectRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "macos",
  "DeepFaceCam.app"
);
const stagingDir = resolve(projectRoot, "build", "dmg-staging", "macos");
const dmgDir = resolve(projectRoot, "src-tauri", "target", "release", "bundle", "dmg");
const arch = process.arch === "arm64" ? "aarch64" : process.arch;
const dmgPath = resolve(dmgDir, `DeepFaceCam_${pkg.version}_${arch}.dmg`);

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("macOS DMG can only be built on macOS.");
  }

  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });
  await mkdir(dmgDir, { recursive: true });
  await rm(dmgPath, { force: true });

  await cp(appDir, resolve(stagingDir, "DeepFaceCam.app"), {
    recursive: true,
  });
  await symlink("/Applications", resolve(stagingDir, "Applications"));

  run("hdiutil", [
    "create",
    "-volname",
    "DeepFaceCam",
    "-srcfolder",
    stagingDir,
    "-ov",
    "-format",
    "UDZO",
    dmgPath,
  ]);

  console.log(`[dmg:macos] wrote ${dmgPath}`);
}

main().catch((error) => {
  console.error(`[dmg:macos] ${error.stack || error.message}`);
  process.exit(1);
});
