#!/usr/bin/env node
// Run the Python backend the way Tauri would. Picks a sensible Python and
// the in-repo backend directory.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function findDlcRoot() {
  const fromEnv = process.env.DEEPFACECAM_DLC;
  if (fromEnv && existsSync(resolve(fromEnv, "modules/backend_server.py"))) {
    return resolve(fromEnv);
  }
  const candidates = [
    resolve(__dirname, "..", "backend"),
    resolve(__dirname, "..", "..", "Deep-Live-Cam"),
  ];
  for (const c of candidates) {
    if (existsSync(resolve(c, "modules/backend_server.py"))) return c;
  }
  throw new Error(
    "Could not locate backend. Set DEEPFACECAM_DLC env var to the folder containing modules/backend_server.py."
  );
}

function findPython(root) {
  if (process.env.DEEPFACECAM_PYTHON) return process.env.DEEPFACECAM_PYTHON;
  const localVenv =
    process.platform === "win32"
      ? resolve(root, ".venv", "Scripts", "python.exe")
      : resolve(root, ".venv", "bin", "python");
  if (existsSync(localVenv)) return localVenv;
  const migrationVenv =
    process.platform === "win32"
      ? resolve(root, "..", "..", "Deep-Live-Cam", ".venv", "Scripts", "python.exe")
      : resolve(root, "..", "..", "Deep-Live-Cam", ".venv", "bin", "python");
  if (existsSync(migrationVenv)) return migrationVenv;
  const tryList = [
    "/opt/homebrew/bin/python3",
    "/usr/local/bin/python3",
    "python3",
    "python",
    "/Users/zeroone/anaconda3/bin/python",
    "/usr/bin/python3",
  ];
  for (const py of tryList) {
    try {
      const r = spawn(py, ["--version"], { stdio: "ignore" });
      if (r.pid) {
        r.kill();
        return py;
      }
    } catch {
      /* ignore */
    }
  }
  return "python3";
}

const root = findDlcRoot();
const py = findPython(root);
const port = process.env.BACKEND_PORT || "8765";

console.log(`[backend] cwd=${root}`);
console.log(`[backend] python=${py}`);
console.log(`[backend] port=${port}`);

const child = spawn(py, ["-m", "modules.backend_server", "--port", port], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

const stop = () => {
  if (!child.killed) child.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);

child.on("exit", (code) => {
  console.log(`[backend] exited with code ${code}`);
  process.exit(code ?? 0);
});
