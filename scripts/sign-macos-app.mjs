#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const defaultAppDir = resolve(
  projectRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "macos",
  "DeepFaceCam.app"
);
const defaultEntitlements = resolve(projectRoot, "src-tauri", "entitlements.plist");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stderr || result.stdout || "");
    }
    process.exit(result.status ?? 1);
  }

  return result.stdout ?? "";
}

function isDirectory(path) {
  try {
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function replaceWithSymlink(target, linkPath) {
  if (existsSync(linkPath)) {
    if (isSymlink(linkPath)) {
      return;
    }
    rmSync(linkPath, { recursive: true, force: true });
  }
  symlinkSync(target, linkPath);
}

function normalizeVersionedFrameworks(appDir) {
  const findOutput = run(
    "find",
    [appDir, "-type", "d", "-name", "*.framework", "-print0"],
    { capture: true }
  );

  for (const frameworkDir of findOutput.split("\0").filter(Boolean)) {
    const versionsDir = join(frameworkDir, "Versions");
    if (!isDirectory(versionsDir)) continue;

    const versions = readdirSync(versionsDir).filter((entry) => {
      if (entry === "Current") return false;
      return isDirectory(join(versionsDir, entry));
    });
    if (versions.length !== 1) continue;

    const frameworkName = basename(frameworkDir, ".framework");
    replaceWithSymlink(versions[0], join(versionsDir, "Current"));
    replaceWithSymlink(
      `Versions/Current/${frameworkName}`,
      join(frameworkDir, frameworkName)
    );
    if (existsSync(join(versionsDir, versions[0], "Resources"))) {
      replaceWithSymlink("Versions/Current/Resources", join(frameworkDir, "Resources"));
    }
  }
}

function resolveSigningIdentity() {
  if (process.env.APPLE_SIGNING_IDENTITY) {
    return process.env.APPLE_SIGNING_IDENTITY;
  }

  const output = run("security", ["find-identity", "-p", "codesigning", "-v"], {
    capture: true,
  });
  const identities = [...output.matchAll(/"([^"]*Developer ID Application:[^"]+)"/g)].map(
    (match) => match[1]
  );

  if (identities.length === 1) {
    return identities[0];
  }

  if (identities.length === 0) {
    throw new Error(
      "No Developer ID Application signing identity found. Set APPLE_SIGNING_IDENTITY after installing the certificate."
    );
  }

  throw new Error(
    `Multiple Developer ID Application identities found (${identities.length}). Set APPLE_SIGNING_IDENTITY explicitly.`
  );
}

function describeIdentity(identity) {
  const match = identity.match(/\(([A-Z0-9]+)\)$/);
  return match ? `Developer ID Application: <redacted> (${match[1]})` : "<redacted>";
}

function findMachOFiles(appDir) {
  const findOutput = run(
    "find",
    [
      appDir,
      "-type",
      "f",
      "(",
      "-perm",
      "-111",
      "-o",
      "-name",
      "*.dylib",
      "-o",
      "-name",
      "*.so",
      "-o",
      "-name",
      "*.node",
      ")",
      "-print0",
    ],
    { capture: true }
  );

  return findOutput
    .split("\0")
    .filter(Boolean)
    .filter((file) => !/\.framework\/[^/]+$/.test(file))
    .filter((file) => {
      const description = run("file", ["-b", file], { capture: true });
      return description.includes("Mach-O");
    })
    .sort((a, b) => b.length - a.length);
}

function findFrameworkVersionDirs(appDir) {
  const findOutput = run(
    "find",
    [appDir, "-type", "d", "-path", "*.framework/Versions/*", "-print0"],
    { capture: true }
  );

  return findOutput
    .split("\0")
    .filter(Boolean)
    .filter((path) => {
      const version = path.split(".framework/Versions/")[1];
      return version && !version.includes("/") && version !== "Current";
    })
    .sort((a, b) => b.length - a.length);
}

function shouldUseTimestamp(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  return value === "1" || value === "true" || value === "yes";
}

function timestampArgs(enabled) {
  return enabled ? ["--timestamp"] : ["--timestamp=none"];
}

function shouldUseAppEntitlementsForNestedFile(file) {
  return basename(file) === "deepfacecam-backend";
}

function signFile(file, identity, useTimestamp, entitlements) {
  const args = [
    "--force",
    ...timestampArgs(useTimestamp),
    "--options",
    "runtime",
  ];
  if (entitlements) {
    args.push("--entitlements", entitlements);
  }
  args.push(
    "--sign",
    identity,
    file
  );
  run("codesign", args);
}

function signApp(appDir, identity, entitlements, useTimestamp) {
  run("codesign", [
    "--force",
    ...timestampArgs(useTimestamp),
    "--options",
    "runtime",
    "--entitlements",
    entitlements,
    "--sign",
    identity,
    appDir,
  ]);
}

function main() {
  if (process.platform !== "darwin") {
    throw new Error("macOS app signing can only run on macOS.");
  }

  const appDir = resolve(projectRoot, argValue("--app") || process.env.MACOS_APP_PATH || defaultAppDir);
  const entitlements = resolve(
    projectRoot,
    argValue("--entitlements") || process.env.MACOS_ENTITLEMENTS || defaultEntitlements
  );

  if (!existsSync(appDir)) {
    throw new Error(`App bundle not found: ${appDir}`);
  }
  if (!existsSync(entitlements)) {
    throw new Error(`Entitlements file not found: ${entitlements}`);
  }

  const identity = resolveSigningIdentity();
  const nestedTimestamp = shouldUseTimestamp(process.env.MACOS_NESTED_TIMESTAMP, false);
  const appTimestamp = shouldUseTimestamp(process.env.MACOS_APP_TIMESTAMP, true);
  console.log(`[sign:macos] signing identity: ${describeIdentity(identity)}`);
  console.log(`[sign:macos] app bundle: ${appDir}`);
  console.log(
    `[sign:macos] timestamps: nested=${nestedTimestamp ? "on" : "off"}, app=${
      appTimestamp ? "on" : "off"
    }`
  );

  normalizeVersionedFrameworks(appDir);

  const machOFiles = findMachOFiles(appDir);
  console.log(`[sign:macos] signing ${machOFiles.length} nested Mach-O files`);
  for (const [index, file] of machOFiles.entries()) {
    if (index % 25 === 0 || process.env.MACOS_SIGN_VERBOSE === "1") {
      console.log(`[sign:macos] nested ${index + 1}/${machOFiles.length}: ${file}`);
    }
    signFile(
      file,
      identity,
      nestedTimestamp,
      shouldUseAppEntitlementsForNestedFile(file) ? entitlements : undefined
    );
  }

  const frameworkVersionDirs = findFrameworkVersionDirs(appDir);
  if (frameworkVersionDirs.length > 0) {
    console.log(
      `[sign:macos] signing ${frameworkVersionDirs.length} framework version bundles`
    );
    for (const frameworkVersionDir of frameworkVersionDirs) {
      signFile(frameworkVersionDir, identity, nestedTimestamp);
    }
  }

  signApp(appDir, identity, entitlements, appTimestamp);

  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appDir]);
  run("codesign", ["-dvvv", "--entitlements", ":-", appDir]);

  console.log("[sign:macos] app signature verified");
}

try {
  main();
} catch (error) {
  console.error(`[sign:macos] ${error.stack || error.message}`);
  process.exit(1);
}
