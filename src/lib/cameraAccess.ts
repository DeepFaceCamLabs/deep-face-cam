interface CameraAccessMessages {
  denied: string;
  unavailable: string;
  busy: string;
  failed: string;
}

export interface CameraAccessResult {
  ok: boolean;
  error?: string;
}

function isMacRuntime() {
  if (typeof navigator === "undefined") return false;
  return /Macintosh|Mac OS X|MacIntel/i.test(navigator.userAgent);
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

export async function ensureCameraAccess(
  messages: CameraAccessMessages
): Promise<CameraAccessResult> {
  if (!isMacRuntime() || !navigator.mediaDevices?.getUserMedia) {
    return { ok: true };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    stopStream(stream);
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    return { ok: true };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return { ok: false, error: messages.denied };
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return { ok: false, error: messages.unavailable };
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return { ok: false, error: messages.busy };
    }
    return { ok: false, error: messages.failed };
  }
}

export function normalizeCameraStartError(
  error: string | undefined,
  fallback: string,
  openFailed: string
) {
  const text = error?.trim();
  if (!text) return fallback;
  if (/failed to open camera|camera did not open/i.test(text)) {
    return openFailed;
  }
  return text;
}

export async function showCameraWarning(title: string, text: string) {
  try {
    const { message } = await import("@tauri-apps/plugin-dialog");
    await message(text, { title, kind: "warning" });
  } catch {
    window.alert(text);
  }
}
