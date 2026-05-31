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

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function runWithRetry(cmd, args, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(cmd, args, {
      cwd: projectRoot,
      stdio: "inherit",
    });
    if (result.status === 0) {
      return;
    }
    if (attempt === attempts) {
      process.exit(result.status ?? 1);
    }
    console.warn(`[dmg:macos] ${cmd} failed; retrying (${attempt + 1}/${attempts})`);
    await rm(dmgPath, { force: true });
    await delay(5000);
  }
}

function capture(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "");
    process.exit(result.status ?? 1);
  }
  return result.stdout ?? "";
}

function resolveSigningIdentity() {
  if (process.env.APPLE_SIGNING_IDENTITY) {
    return process.env.APPLE_SIGNING_IDENTITY;
  }

  const output = capture("security", ["find-identity", "-p", "codesigning", "-v"]);
  const identities = [...output.matchAll(/"([^"]*Developer ID Application:[^"]+)"/g)].map(
    (match) => match[1]
  );

  if (identities.length === 1) {
    return identities[0];
  }

  if (identities.length === 0) {
    throw new Error("No Developer ID Application signing identity found for DMG signing.");
  }

  throw new Error(
    `Multiple Developer ID Application identities found (${identities.length}). Set APPLE_SIGNING_IDENTITY explicitly.`
  );
}

function describeIdentity(identity) {
  const match = identity.match(/\(([A-Z0-9]+)\)$/);
  return match ? `Developer ID Application: <redacted> (${match[1]})` : "<redacted>";
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

  await runWithRetry("hdiutil", [
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

  if (process.env.MACOS_SIGN_DMG === "1" || process.env.MACOS_SIGN_DMG === "true") {
    const identity = resolveSigningIdentity();
    console.log(`[dmg:macos] signing DMG with ${describeIdentity(identity)}`);
    run("codesign", ["--force", "--timestamp", "--sign", identity, dmgPath]);
    run("codesign", ["--verify", "--verbose=2", dmgPath]);
  }

  console.log(`[dmg:macos] wrote ${dmgPath}`);
}

main().catch((error) => {
  console.error(`[dmg:macos] ${error.stack || error.message}`);
  process.exit(1);
});
