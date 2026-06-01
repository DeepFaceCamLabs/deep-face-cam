import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { Dialog } from "./Dialog";
import { Switch } from "./Switch";
import { Slider } from "./Slider";
import { useUi } from "@/lib/store";
import { rpc } from "@/rpc/client";
import { Tooltip } from "./Tooltip";
import { useI18n } from "@/i18n";
import { LanguageSelect } from "./LanguageSelect";
import type { RuntimeDiagnostics } from "@/rpc/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ENCODERS = ["libx264", "libx265", "libvpx-vp9"];

function ProviderPills({ providers }: { providers?: string[] }) {
  if (!providers?.length) {
    return <span className="text-xs text-zinc-500">None</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {providers.map((provider) => (
        <span
          key={provider}
          className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-200"
        >
          {provider.replace("ExecutionProvider", "")}
        </span>
      ))}
    </div>
  );
}

function formatMs(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toFixed(value >= 100 ? 0 : 1)} ms`;
}

function formatMemory(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return `${Math.round(value / 1024)} GB`;
}

export function SettingsModal({ open, onClose }: Props) {
  const { t } = useI18n();
  const state = useUi((s) => s.state);
  const patch = useUi((s) => s.patchState);
  const pushStatus = useUi((s) => s.pushStatus);
  const [diag, setDiag] = useState<RuntimeDiagnostics | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refreshDiagnostics = async () => {
    setDiagLoading(true);
    setDiagError(null);
    try {
      const next = await rpc.runtimeDiagnostics();
      setDiag(next);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("settings.diagnosticsFailed");
      setDiagError(message);
    } finally {
      setDiagLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    refreshDiagnostics().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const actualCudaSessions = useMemo(
    () =>
      diag?.sessions.filter(
        (session) =>
          session.loaded && session.providers.includes("CUDAExecutionProvider")
      ).length ?? 0,
    [diag]
  );

  const loadedSessions = useMemo(
    () => diag?.sessions.filter((session) => session.loaded).length ?? 0,
    [diag]
  );

  const copyDiagnostics = async () => {
    if (!diag) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(diag, null, 2));
      setCopied(true);
      pushStatus(t("settings.diagnosticsCopied"));
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("settings.diagnosticsFailed");
      pushStatus(message);
    }
  };

  if (!state) return null;

  const setBool = async (k: any, v: boolean) => {
    patch({ [k]: v });
    await rpc.setState({ [k]: v });
  };
  const setNum = async (k: any, v: number) => {
    patch({ [k]: v });
    await rpc.setState({ [k]: v });
  };
  const setStr = async (k: any, v: string) => {
    patch({ [k]: v });
    await rpc.setState({ [k]: v });
  };
  const setProviders = async (next: string[]) => {
    patch({ execution_providers: next });
    await rpc.setState({ execution_providers: next });
  };

  const toggleProvider = (p: string) => {
    const curr = state.execution_providers;
    const has = curr.includes(p);
    setProviders(has ? curr.filter((x) => x !== p) : [...curr, p]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={t("settings.title")}
      description={t("settings.description")}
      size="lg"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4">
          <div className="space-y-2">
            <h4 className="label">{t("settings.general")}</h4>
            <div className="space-y-1.5">
              <div className="text-sm text-zinc-300">
                {t("settings.languageHint")}
              </div>
              <LanguageSelect />
            </div>
          </div>

          <h4 className="label pt-2">{t("settings.execution")}</h4>
          <div className="flex flex-wrap gap-2">
            {state.available_providers?.length ? (
              state.available_providers.map((p) => (
                <button
                  key={p}
                  onClick={() => toggleProvider(p)}
                  className={
                    "rounded-full border px-3 py-1 text-xs " +
                    (state.execution_providers.includes(p)
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]")
                  }
                >
                  {p}
                </button>
              ))
            ) : (
              <span className="text-xs text-zinc-500">
                {t("settings.providersNone")}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">
                {t("settings.executionThreads")}
              </span>
              <span className="text-xs text-zinc-500">
                {state.execution_threads ?? t("settings.auto")}
              </span>
            </div>
            <Slider
              min={1}
              max={32}
              step={1}
              value={state.execution_threads ?? 4}
              onValueChange={(v) => setNum("execution_threads", v)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">
                {t("settings.maxMemory")}
              </span>
              <span className="text-xs text-zinc-500">
                {state.max_memory ?? t("settings.auto")}
              </span>
            </div>
            <Slider
              min={1}
              max={64}
              step={1}
              value={state.max_memory ?? 4}
              onValueChange={(v) => setNum("max_memory", v)}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h4 className="label">{t("settings.videoOutput")}</h4>
          <div className="flex flex-wrap gap-1.5">
            {ENCODERS.map((e) => (
              <button
                key={e}
                onClick={() => setStr("video_encoder", e)}
                className={
                  "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition " +
                  (state.video_encoder === e
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-white/5 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]")
                }
              >
                {e}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">
                {t("settings.videoQuality")}
              </span>
              <span className="text-xs text-zinc-500">{state.video_quality}</span>
            </div>
            <Slider
              min={0}
              max={51}
              step={1}
              value={state.video_quality}
              onValueChange={(v) => setNum("video_quality", v)}
            />
          </div>

          <h4 className="label pt-2">{t("settings.interpolation")}</h4>
          <Tooltip content={t("settings.enableTemporal")}>
            <label className="flex items-center justify-between gap-2">
              <span className="text-sm text-zinc-300">
                {t("settings.enableTemporal")}
              </span>
              <Switch
                checked={state.enable_interpolation}
                onCheckedChange={(v) => setBool("enable_interpolation", v)}
              />
            </label>
          </Tooltip>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">
                {t("settings.currentFrameWeight")}
              </span>
              <span className="text-xs text-zinc-500">
                {state.interpolation_weight.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={state.interpolation_weight}
              onValueChange={(v) => setNum("interpolation_weight", v)}
              formatValue={(v) => v.toFixed(2)}
            />
          </div>
        </section>

        <section className="space-y-3 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="label">{t("settings.diagnostics")}</h4>
              <p className="mt-1 text-xs text-zinc-500">
                {t("settings.diagnosticsHint")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshDiagnostics}
                disabled={diagLoading}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                {diagLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {t("settings.diagnosticsRefresh")}
              </button>
              <button
                onClick={copyDiagnostics}
                disabled={!diag}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                <Copy size={14} />
                {copied
                  ? t("settings.diagnosticsCopiedShort")
                  : t("settings.diagnosticsCopy")}
              </button>
            </div>
          </div>

          {diagError ? (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-red-100">
              {diagError}
            </div>
          ) : null}

          {!diag && diagLoading ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-zinc-400">
              {t("settings.diagnosticsLoading")}
            </div>
          ) : null}

          {diag ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  {t("settings.diagnosticsRuntime")}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-zinc-500">
                      {t("settings.diagnosticsActive")}
                    </div>
                    <div className="mt-1">
                      <ProviderPills providers={diag.onnxruntime.active_providers} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">
                      {t("settings.diagnosticsAvailable")}
                    </div>
                    <div className="mt-1">
                      <ProviderPills providers={diag.onnxruntime.available_providers} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">ONNX Runtime</div>
                    <div className="mt-1 text-sm text-zinc-200">
                      {diag.onnxruntime.version ?? "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">
                      {t("settings.diagnosticsPackage")}
                    </div>
                    <div className="mt-1 text-sm text-zinc-200">
                      {diag.package.variant}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  {t("settings.diagnosticsGpu")}
                </div>
                <div className="mt-3 space-y-2">
                  {diag.nvidia.gpus.length ? (
                    diag.nvidia.gpus.map((gpu) => (
                      <div
                        key={gpu.index}
                        className="rounded-md border border-white/10 bg-black/10 px-3 py-2"
                      >
                        <div className="text-sm font-medium text-zinc-100">
                          {gpu.name}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {[
                            gpu.driver_version
                              ? `Driver ${gpu.driver_version}`
                              : null,
                            gpu.compute_capability
                              ? `CC ${gpu.compute_capability}`
                              : null,
                            formatMemory(gpu.memory_total_mb),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-zinc-400">
                      {t("settings.diagnosticsNoGpu")}
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-white/10 bg-black/10 px-3 py-2">
                      <div className="text-xs text-zinc-500">Torch CUDA</div>
                      <div className="mt-1 text-sm text-zinc-200">
                        {diag.torch.cuda_available
                          ? t("settings.diagnosticsYes")
                          : t("settings.diagnosticsNo")}
                      </div>
                    </div>
                    <div className="rounded-md border border-white/10 bg-black/10 px-3 py-2">
                      <div className="text-xs text-zinc-500">cuDNN</div>
                      <div className="mt-1 text-sm text-zinc-200">
                        {diag.torch.cudnn_version ?? "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {t("settings.diagnosticsSessions")}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {actualCudaSessions}/{loadedSessions} CUDA
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {diag.sessions.map((session) => (
                    <div
                      key={session.name}
                      className="rounded-md border border-white/10 bg-black/10 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-zinc-200">
                          {session.name}
                        </span>
                        <span
                          className={
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] " +
                            (session.providers.includes("CUDAExecutionProvider")
                              ? "bg-accent/15 text-accent"
                              : session.loaded
                                ? "bg-amber-400/15 text-amber-200"
                                : "bg-white/5 text-zinc-500")
                          }
                        >
                          {session.loaded
                            ? session.providers.includes("CUDAExecutionProvider")
                              ? "CUDA"
                              : session.providers[0]?.replace(
                                  "ExecutionProvider",
                                  ""
                                ) ?? "CPU"
                            : t("settings.diagnosticsNotLoaded")}
                        </span>
                      </div>
                      {session.model ? (
                        <div className="mt-1 truncate text-[11px] text-zinc-500">
                          {session.model}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {t("settings.diagnosticsLive")}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {diag.live.running && typeof diag.live.fps === "number"
                      ? `${diag.live.fps.toFixed(1)} FPS`
                      : t("settings.diagnosticsNotRunning")}
                  </div>
                </div>
                {diag.live.metrics ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      "capture_ms",
                      "detect_ms",
                      "swap_ms",
                      "enhance_ms",
                      "encode_ms",
                      "process_ms",
                    ].map((key) => (
                      <div
                        key={key}
                        className="rounded-md border border-white/10 bg-black/10 px-3 py-2"
                      >
                        <div className="text-[11px] text-zinc-500">
                          {key.replace("_ms", "")}
                        </div>
                        <div className="mt-1 text-sm text-zinc-200">
                          {formatMs(diag.live.metrics?.[key]?.avg_ms)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-zinc-400">
                    {t("settings.diagnosticsNoLiveMetrics")}
                  </div>
                )}
              </div>

              {diag.warnings.length ? (
                <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 lg:col-span-2">
                  <div className="text-xs uppercase tracking-wide text-amber-200">
                    {t("settings.diagnosticsWarnings")}
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-amber-50/90">
                    {diag.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </Dialog>
  );
}
