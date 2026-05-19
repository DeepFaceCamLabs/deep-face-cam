#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const defaultBundleDir = resolve(root, "src-tauri", "target", "release", "bundle");
const outputFile = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(defaultBundleDir, "SHA256SUMS.txt");

const extensions = new Set([".dmg", ".msi", ".exe", ".pkg", ".zip"]);

async function walk(dir, files = []) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.endsWith(".app")) continue;
      await walk(path, files);
    } else {
      if (entry.name.startsWith("rw.")) continue;
      const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
      if (extensions.has(ext)) files.push(path);
    }
  }
  return files;
}

function sha256(path) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolveHash(hash.digest("hex")));
  });
}

async function main() {
  const files = (await walk(defaultBundleDir)).sort();
  if (files.length === 0) {
    throw new Error(`No release artifacts found under ${defaultBundleDir}`);
  }

  const lines = [];
  for (const file of files) {
    const info = await stat(file);
    if (!info.isFile()) continue;
    const hash = await sha256(file);
    lines.push(`${hash}  ${relative(defaultBundleDir, file)}`);
  }

  await writeFile(outputFile, `${lines.join("\n")}\n`);
  console.log(`[checksums] wrote ${outputFile}`);
  for (const line of lines) {
    console.log(`[checksums] ${line}`);
  }
}

main().catch((error) => {
  console.error(`[checksums] ${error.stack || error.message}`);
  process.exit(1);
});
