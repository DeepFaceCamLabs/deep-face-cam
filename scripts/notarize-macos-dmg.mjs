#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import pkg from "../package.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const arch = process.arch === "arm64" ? "aarch64" : process.arch;
const defaultDmgPath = resolve(
  projectRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "dmg",
  `DeepFaceCam_${pkg.version}_${arch}.dmg`
);

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function capture(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function notarizationArgs() {
  if (
    process.env.APPLE_API_KEY_PATH &&
    process.env.APPLE_API_KEY_ID &&
    process.env.APPLE_API_ISSUER_ID
  ) {
    return [
      "--key",
      process.env.APPLE_API_KEY_PATH,
      "--key-id",
      process.env.APPLE_API_KEY_ID,
      "--issuer",
      process.env.APPLE_API_ISSUER_ID,
    ];
  }

  const profile = process.env.NOTARY_PROFILE || "deepfacecam-notary";
  return ["--keychain-profile", profile];
}

function main() {
  if (process.platform !== "darwin") {
    throw new Error("macOS notarization can only run on macOS.");
  }

  const dmgPath = resolve(projectRoot, argValue("--dmg") || process.env.MACOS_DMG_PATH || defaultDmgPath);
  if (!existsSync(dmgPath)) {
    throw new Error(`DMG not found: ${dmgPath}`);
  }

  console.log(`[notarize:macos] submitting ${dmgPath}`);
  const authArgs = notarizationArgs();
  const submission = capture("xcrun", [
    "notarytool",
    "submit",
    dmgPath,
    ...authArgs,
    "--wait",
    "--output-format",
    "json",
  ]);

  if (submission.stdout) {
    process.stdout.write(submission.stdout);
    if (!submission.stdout.endsWith("\n")) {
      process.stdout.write("\n");
    }
  }

  let submissionJson;
  try {
    submissionJson = JSON.parse(submission.stdout);
  } catch {
    submissionJson = undefined;
  }

  if (submission.status !== 0 || submissionJson?.status !== "Accepted") {
    if (submissionJson?.id) {
      console.error(`[notarize:macos] fetching Apple log for ${submissionJson.id}`);
      run("xcrun", ["notarytool", "log", submissionJson.id, ...authArgs]);
    }
    process.exit(submission.status || 1);
  }

  console.log("[notarize:macos] stapling ticket");
  run("xcrun", ["stapler", "staple", dmgPath]);
  run("xcrun", ["stapler", "validate", dmgPath]);

  console.log("[notarize:macos] Gatekeeper assessment");
  const assessment = capture("spctl", [
    "--assess",
    "--type",
    "open",
    "--context",
    "context:primary-signature",
    "--verbose=4",
    dmgPath,
  ]);
  if (assessment.stdout) {
    process.stdout.write(assessment.stdout);
  }
  if (assessment.stderr) {
    process.stderr.write(assessment.stderr);
  }
  if (assessment.status !== 0) {
    console.warn("[notarize:macos] Gatekeeper assessment was inconclusive; notarization and stapling succeeded.");
  }

  console.log("[notarize:macos] notarization complete");
}

try {
  main();
} catch (error) {
  console.error(`[notarize:macos] ${error.stack || error.message}`);
  process.exit(1);
}
