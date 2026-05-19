/**
 * File dialog adapter.
 *
 * In Tauri we delegate to the native dialog plugin (real OS picker, real
 * filesystem path). In a plain browser dev session we open a hidden
 * `<input type="file">`, then upload the chosen file to the Python
 * backend's `/upload` endpoint — the backend writes the bytes to a real
 * tempfile path that the engine can read.
 */

import { rpc } from "@/rpc/client";

export interface OpenFileOptions {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  multiple?: boolean;
  directory?: boolean;
}

export interface SaveFileOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const isTauri = () =>
  typeof window !== "undefined" && window.__TAURI_INTERNALS__ != null;

function acceptFromFilters(filters?: OpenFileOptions["filters"]): string {
  if (!filters?.length) return "";
  const parts = new Set<string>();
  for (const f of filters) {
    for (const ext of f.extensions) parts.add("." + ext.toLowerCase());
  }
  return Array.from(parts).join(",");
}

function uploadViaInput(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.opacity = "0";
    document.body.appendChild(input);

    let settled = false;
    const cleanup = () => {
      if (input.parentElement) input.parentElement.removeChild(input);
    };

    input.addEventListener(
      "change",
      async () => {
        if (settled) return;
        settled = true;
        const file = input.files?.[0];
        cleanup();
        if (!file) {
          resolve(null);
          return;
        }
        try {
          const fd = new FormData();
          fd.append("file", file, file.name);
          const r = await fetch(`${rpc.httpBase}/upload`, {
            method: "POST",
            body: fd,
          });
          const json = await r.json();
          if (!json.ok || !json.path) {
            console.error("upload failed", json);
            resolve(null);
            return;
          }
          resolve(json.path);
        } catch (err) {
          console.error("upload error", err);
          resolve(null);
        }
      },
      { once: true }
    );

    // If the user dismisses the dialog without picking anything we
    // never get 'change'. Fall back to focus+cancel detection.
    const onFocusBack = () => {
      window.removeEventListener("focus", onFocusBack);
      // Give 'change' a moment to fire first
      setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve(null);
        }
      }, 400);
    };
    window.addEventListener("focus", onFocusBack);

    input.click();
  });
}

export async function pickFile(
  opts: OpenFileOptions = {}
): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      multiple: false,
      directory: opts.directory ?? false,
      title: opts.title,
      filters: opts.filters,
    });
    if (Array.isArray(result)) return result[0] ?? null;
    return (result as string | null) ?? null;
  }

  // Browser fallback: real OS file picker, then upload to backend
  // so we end up with a real filesystem path.
  const accept = acceptFromFilters(opts.filters);
  return uploadViaInput(accept);
}

export async function pickSave(
  opts: SaveFileOptions = {}
): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    return (await save({
      title: opts.title,
      defaultPath: opts.defaultPath,
      filters: opts.filters,
    })) as string | null;
  }
  // Browser fallback for "save as": we can't drive a native save dialog
  // from JS, so let the user confirm an output path. Default to
  // ~/Downloads if we can detect it via the backend's tempdir helper.
  const def =
    opts.defaultPath && opts.defaultPath.includes("/")
      ? opts.defaultPath
      : `/tmp/${opts.defaultPath ?? "output.mp4"}`;
  const path = window.prompt(
    (opts.title ?? "Save as") +
      "\n\nBrowser mode can't open a native save dialog. Type or paste an absolute path:",
    def
  );
  return path?.trim() || null;
}

export const FILTERS = {
  image: { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "bmp"] },
  video: { name: "Videos", extensions: ["mp4", "mkv", "mov"] },
  media: {
    name: "Media",
    extensions: ["png", "jpg", "jpeg", "gif", "bmp", "mp4", "mkv", "mov"],
  },
  outputImage: {
    name: "Image",
    extensions: ["png", "jpg", "jpeg", "bmp"],
  },
  outputVideo: {
    name: "Video",
    extensions: ["mp4", "mkv"],
  },
};
