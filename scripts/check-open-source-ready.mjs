#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredFiles = [
  "LICENSE",
  "NOTICE.md",
  "MODEL_LICENSES.md",
  "README.md",
  "CHANGELOG.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "docs/DISTRIBUTION.md",
  "docs/BUY_ME_A_COFFEE.md",
  "docs/GITHUB_SETUP.md",
  "docs/MODELS.md",
  "docs/PRIVACY.md",
  "docs/RESPONSIBLE_USE.md",
  "docs/OPEN_SOURCE_RELEASE.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/RELEASE_TEMPLATE.md",
  ".github/workflows/ci.yml",
  ".gitignore",
  ".gitattributes",
  "models/manifest.json",
];

const forbiddenPatterns = [
  /^node_modules\//,
  /^dist\//,
  /^build\//,
  /^src-tauri\/target\//,
  /^src-tauri\/generated\//,
  /^packaging\/pyinstaller\/runtime\//,
  /^backend\/outputs\//,
  /^backend\/switch_states\.json$/,
  /^backend\/models\/.*\.(onnx|pth|pt|zip|safetensors)$/i,
  /^backend\/models\/insightface\/models\//,
  /\.env(\.|$)/,
  /\.(dmg|msi|exe|pkg)$/i,
];

const secretPatterns = [
  /BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY/,
  /APPLE_APP_SPECIFIC_PASSWORD\s*=\s*["']?[^"'<\s$][^"'\s]*/i,
  /ASC_API_KEY\s*=\s*["']?[^"'<\s$][^"'\s]*/i,
  /AWS_SECRET_ACCESS_KEY\s*=\s*["']?[^"'<\s$][^"'\s]*/i,
  /GITHUB_TOKEN\s*=\s*["']?[^"'<\s$][^"'\s]*/i,
];

function runGit(args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function listPublishableFiles() {
  const gitRoot = runGit(["rev-parse", "--show-toplevel"]);
  if (gitRoot) {
    const output = runGit(["ls-files", "--cached", "--others", "--exclude-standard"]);
    return output ? output.split("\n").filter(Boolean) : [];
  }
  return [];
}

function checkRequiredFiles(errors) {
  for (const file of requiredFiles) {
    const path = resolve(root, file);
    if (!existsSync(path)) {
      errors.push(`Missing required file: ${file}`);
    } else if (statSync(path).isFile() && statSync(path).size === 0) {
      errors.push(`Required file is empty: ${file}`);
    }
  }
}

function checkForbiddenFiles(files, errors) {
  for (const file of files) {
    const normalized = file.replaceAll("\\", "/");
    if (forbiddenPatterns.some((pattern) => pattern.test(normalized))) {
      errors.push(`Forbidden file would be published: ${normalized}`);
    }
  }
}

async function checkManifest(errors) {
  const manifestPath = resolve(root, "models", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!Array.isArray(manifest.models) || manifest.models.length === 0) {
    errors.push("models/manifest.json has no models array");
    return;
  }
  for (const model of manifest.models) {
    for (const key of ["id", "filename", "purpose", "required", "size_bytes", "sha256", "source_url"]) {
      if (!(key in model)) {
        errors.push(`Model ${model.id ?? model.filename ?? "<unknown>"} missing ${key}`);
      }
    }
    if (typeof model.sha256 === "string" && !/^[a-f0-9]{64}$/i.test(model.sha256)) {
      errors.push(`Model ${model.id} has invalid sha256`);
    }
  }
}

async function checkSecrets(files, errors, warnings) {
  const textFiles = files.filter((file) => {
    if (file === "scripts/check-open-source-ready.mjs") return false;
    const ext = file.split(".").pop()?.toLowerCase();
    return ["md", "json", "yml", "yaml", "toml", "ts", "tsx", "js", "mjs", "rs", "py", "txt"].includes(ext ?? "");
  });

  for (const file of textFiles) {
    const path = resolve(root, file);
    if (!existsSync(path) || !statSync(path).isFile()) continue;
    const text = await readFile(path, "utf8");
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) {
        errors.push(`Possible secret reference in publishable file: ${file}`);
      }
    }
    if (text.includes("OWNER/REPO") || text.includes("your_handle")) {
      warnings.push(`Placeholder remains in ${file}`);
    }
  }
}

async function main() {
  const errors = [];
  const warnings = [];
  checkRequiredFiles(errors);
  await checkManifest(errors);

  const files = listPublishableFiles();
  if (files.length === 0) {
    warnings.push("No git file list available yet. Run git init before final publication.");
  } else {
    checkForbiddenFiles(files, errors);
    await checkSecrets(files, errors, warnings);
  }

  for (const warning of warnings) {
    console.warn(`[open-source:warn] ${warning}`);
  }

  if (errors.length) {
    for (const error of errors) {
      console.error(`[open-source:error] ${error}`);
    }
    process.exit(1);
  }

  const cwd = relative(process.cwd(), root) || ".";
  console.log(`[open-source] ${cwd} looks ready for a source publish check.`);
}

main().catch((error) => {
  console.error(`[open-source:error] ${error.stack || error.message}`);
  process.exit(1);
});
