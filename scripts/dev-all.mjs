#!/usr/bin/env node
// Spawn Python backend + Vite dev server side-by-side. For pure-web dev
// (no Tauri shell). Use `npm run tauri:dev` for the desktop shell.

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function run(name, cmd, args, opts = {}) {
  const proc = spawn(cmd, args, {
    cwd: root,
    stdio: ["inherit", "pipe", "pipe"],
    shell: true,
    env: process.env,
    ...opts,
  });
  const prefix = `\x1b[${name === "backend" ? "36" : "35"}m[${name}]\x1b[0m`;
  proc.stdout.on("data", (b) => process.stdout.write(`${prefix} ${b}`));
  proc.stderr.on("data", (b) => process.stderr.write(`${prefix} ${b}`));
  proc.on("exit", (code) => {
    console.log(`${prefix} exited with code ${code}`);
    process.exit(code ?? 0);
  });
  return proc;
}

const backend = run("backend", "node", ["scripts/run-backend.mjs"]);
const vite = run("vite", "npx", ["vite", "--host", "127.0.0.1"]);

const stop = () => {
  if (!backend.killed) backend.kill();
  if (!vite.killed) vite.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
