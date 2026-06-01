import type {
  AppState,
  MapEntry,
  ModelStatus,
  RuntimeDiagnostics,
  ServerEvent,
} from "./types";

type Pending = {
  resolve: (v: any) => void;
  reject: (e: unknown) => void;
  timer?: number;
};

const DEFAULT_PORT = Number(import.meta.env.VITE_BACKEND_PORT ?? 8765);
const DEFAULT_HOST = import.meta.env.VITE_BACKEND_HOST ?? "127.0.0.1";

export class RpcClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private listeners = new Set<(e: ServerEvent) => void>();
  private connectionListeners = new Set<(connected: boolean) => void>();
  private url: string;
  private reconnectTimer: number | null = null;
  private destroyed = false;

  constructor(
    public host: string = DEFAULT_HOST,
    public port: number = DEFAULT_PORT
  ) {
    this.url = `ws://${host}:${port}/rpc`;
  }

  configure(host: string, port: number): void {
    if (this.host === host && this.port === port) return;
    this.host = host;
    this.port = port;
    this.url = `ws://${host}:${port}/rpc`;
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get httpBase(): string {
    return `http://${this.host}:${this.port}`;
  }

  connect(): void {
    if (this.destroyed) return;
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1))
      return;
    try {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => this.fireConnection(true);
      ws.onclose = () => {
        this.fireConnection(false);
        if (!this.destroyed) {
          this.scheduleReconnect();
        }
      };
      ws.onerror = () => {
        // browsers don't expose error details; close will fire next
      };
      ws.onmessage = (m) => this.onMessage(m.data);
    } catch (_err) {
      this.scheduleReconnect();
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer != null) window.clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.pending.forEach((p) => p.reject(new Error("client destroyed")));
    this.pending.clear();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer != null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 800);
  }

  private fireConnection(connected: boolean): void {
    this.connectionListeners.forEach((l) => l(connected));
  }

  on(listener: (e: ServerEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onConnection(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  private onMessage(raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof msg.id === "number") {
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        if (p.timer != null) window.clearTimeout(p.timer);
        if (msg.error) p.reject(new Error(msg.error));
        else p.resolve(msg.result);
      }
      return;
    }
    if (typeof msg.event === "string") {
      this.listeners.forEach((l) => l(msg as ServerEvent));
    }
  }

  call<T = unknown>(
    method: string,
    params?: any,
    timeoutMs = 120_000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) {
        reject(new Error("not connected"));
        return;
      }
      const id = this.nextId++;
      const pending: Pending = { resolve, reject };
      if (timeoutMs > 0) {
        pending.timer = window.setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`Request timed out: ${method}`));
        }, timeoutMs);
      }
      this.pending.set(id, pending);
      this.ws.send(
        JSON.stringify({ id, method, params: params ?? {} })
      );
    });
  }

  // ── strongly-typed wrappers ─────────────────────────────────────

  getState(): Promise<AppState> {
    return this.call("get_state");
  }
  getRuntimePaths(): Promise<Record<string, string>> {
    return this.call("get_runtime_paths");
  }
  runtimeDiagnostics(): Promise<RuntimeDiagnostics> {
    return this.call("runtime_diagnostics", undefined, 15_000);
  }
  modelStatus(verify = false) {
    return this.call<ModelStatus>("model_status", { verify });
  }
  downloadModels(ids?: string[], requiredOnly = false) {
    return this.call<{
      ok: boolean;
      results: Array<{ ok: boolean; id: string; path?: string; error?: string; skipped?: boolean }>;
      status: ModelStatus;
    }>("download_models", { ids, required_only: requiredOnly }, 0);
  }
  setState(patch: Partial<AppState>): Promise<AppState> {
    return this.call("set_state", { patch });
  }
  setSource(path: string | null): Promise<{ ok: boolean; state: AppState; error?: string }> {
    return this.call("set_source_path", { path });
  }
  setTarget(path: string | null) {
    return this.call<{ ok: boolean; state: AppState; error?: string }>(
      "set_target_path",
      { path }
    );
  }
  setOutput(path: string | null) {
    return this.call<{ ok: boolean; state: AppState; error?: string }>(
      "set_output_path",
      { path }
    );
  }
  swapPaths() {
    return this.call<{ ok: boolean; state: AppState; error?: string }>(
      "swap_paths"
    );
  }
  randomFace() {
    return this.call<{ ok: boolean; path?: string; state?: AppState; error?: string }>(
      "random_face"
    );
  }
  listCameras() {
    return this.call<Array<{ index: number; name: string; disabled?: boolean }>>(
      "list_cameras"
    );
  }
  videoFrameCount(path?: string | null) {
    return this.call<number>("video_frame_count", { path });
  }
  previewFrame(frame: number) {
    return this.call<{ ok: boolean; size?: number; error?: string }>(
      "preview_frame",
      { frame_number: frame },
      180_000
    );
  }
  start(autoOutput = false) {
    return this.call<{
      ok: boolean;
      output_path?: string;
      state?: AppState;
      error?: string;
    }>("start", { auto_output: autoOutput });
  }
  saveOutputAs(path: string) {
    return this.call<{ ok: boolean; path?: string; state?: AppState; error?: string }>(
      "save_output_as",
      { path }
    );
  }
  revealOutput() {
    return this.call<{ ok: boolean; error?: string }>("reveal_output");
  }
  destroyEngine() {
    return this.call<{ ok: boolean }>("destroy");
  }
  startLive(camera: number) {
    return this.call<{ ok: boolean; error?: string }>("start_live", {
      camera_index: camera,
    });
  }
  stopLive() {
    return this.call<{ ok: boolean }>("stop_live");
  }
  mappingExtract() {
    return this.call<{ ok: boolean; map?: MapEntry[]; error?: string }>(
      "mapping_extract"
    );
  }
  mappingSetSource(row: number, path: string) {
    return this.call<{ ok: boolean; map?: MapEntry[]; error?: string }>(
      "mapping_set_source",
      { row, path }
    );
  }
  mappingSetTarget(row: number, path: string) {
    return this.call<{ ok: boolean; map?: MapEntry[]; error?: string }>(
      "mapping_set_target",
      { row, path }
    );
  }
  mappingAdd() {
    return this.call<{ ok: boolean; map: MapEntry[] }>("mapping_add");
  }
  mappingClear() {
    return this.call<{ ok: boolean; map: MapEntry[] }>("mapping_clear");
  }
  mappingReset() {
    return this.call<{ ok: boolean; map: MapEntry[] }>("mapping_reset");
  }
  mappingGet() {
    return this.call<{ ok: boolean; map: MapEntry[] }>("mapping_get");
  }
  mappingValid() {
    return this.call<boolean>("mapping_valid");
  }
  mappingSimplify() {
    return this.call<{ ok: boolean; error?: string }>("mapping_simplify");
  }
}

export const rpc = new RpcClient();
