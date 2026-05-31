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

interface NativeCameraAccessResult {
  granted?: boolean;
  status?: string;
}

function isMacRuntime() {
  if (typeof navigator === "undefined") return false;
  return /Macintosh|Mac OS X|MacIntel/i.test(navigator.userAgent);
}

function isTauriRuntime() {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in
      (window as unknown as Record<string, unknown>)
  );
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

function nativeCameraError(
  result: NativeCameraAccessResult,
  messages: CameraAccessMessages
) {
  if (result.status === "unavailable") return messages.unavailable;
  if (result.status === "timeout") return messages.failed;
  if (result.status === "unknown") return messages.failed;
  return messages.denied;
}

async function ensureNativeCameraAccess(
  messages: CameraAccessMessages
): Promise<CameraAccessResult | null> {
  if (!isTauriRuntime()) return null;

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<NativeCameraAccessResult>(
      "request_camera_permission"
    );
    if (result.granted) return { ok: true };
    return { ok: false, error: nativeCameraError(result, messages) };
  } catch {
    return null;
  }
}

export async function ensureCameraAccess(
  messages: CameraAccessMessages
): Promise<CameraAccessResult> {
  if (!isMacRuntime()) {
    return { ok: true };
  }

  const nativeAccess = await ensureNativeCameraAccess(messages);
  if (nativeAccess) return nativeAccess;

  if (!navigator.mediaDevices?.getUserMedia) {
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
