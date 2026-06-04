import { Eye, FolderOpen, Play, Save, Square } from "lucide-react";
import { useUi } from "@/lib/store";
import { rpc } from "@/rpc/client";
import { FILTERS, pickSave } from "@/lib/dialog";
import { cx } from "@/lib/cx";
import { Tooltip } from "./Tooltip";
import { useI18n } from "@/i18n";

function isImage(p: string | null) {
  if (!p) return false;
  const e = (p.split(".").pop() ?? "").toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "bmp"].includes(e);
}

function basename(p: string | null) {
  if (!p) return "";
  return p.split(/[\\/]/).pop() ?? p;
}

export function ActionBar() {
  const { t } = useI18n();
  const state = useUi((s) => s.state);
  const setState = useUi((s) => s.setState);
  const pushStatus = useUi((s) => s.pushStatus);
  const setModal = useUi((s) => s.setModal);
  const setStageMode = useUi((s) => s.setStageMode);
  const stageMode = useUi((s) => s.stageMode);
  const progress = useUi((s) => s.processingProgress);

  if (!state) return null;

  const hasMedia = Boolean(state.source_path && state.target_path);
  const hasOutput = Boolean(state.output_path);
  const processing = Boolean(state.processing);
  const liveRunning = Boolean(state.live_running);
  const stopActive =
    processing || liveRunning || stageMode === "preview" || stageMode === "live";
  const canStart = hasMedia && !processing;
  const percent =
    processing && progress?.ratio != null
      ? Math.max(0, Math.min(100, Math.round(progress.ratio * 100)))
      : null;

  const onStart = async () => {
    if (!hasMedia) {
      pushStatus(t("action.selectFirst"));
      return;
    }
    if (state.map_faces) {
      pushStatus(t("action.detectingFaces"));
      const r = await rpc.mappingExtract();
      if (!r.ok || !r.map?.length) {
        pushStatus(r.error ?? t("action.noFaces"));
        return;
      }
      useUi.getState().setMapping(r.map);
      setModal("mapping");
      return;
    }
    if (liveRunning) await rpc.stopLive().catch(() => undefined);
    setStageMode("idle");
    pushStatus(t("action.generating"));
    const res = await rpc.start(true);
    if (!res.ok) {
      pushStatus(res.error ?? t("action.failedStart"));
      return;
    }
    if (res.state) setState(res.state);
  };

  const onPreview = async () => {
    if (!hasMedia) {
      pushStatus(t("action.selectFirst"));
      return;
    }
    if (liveRunning) await rpc.stopLive().catch(() => undefined);
    setStageMode("preview");
  };

  const onStop = async () => {
    if (liveRunning) {
      await rpc.stopLive().catch(() => undefined);
    }
    if (processing) {
      await rpc.destroyEngine().catch(() => undefined);
    }
    setStageMode("idle");
  };

  const onSaveAs = async () => {
    if (!state.output_path) return;
    const isImg = isImage(state.output_path);
    const out = await pickSave({
      title: isImg ? t("action.saveImageDialog") : t("action.saveVideoDialog"),
      defaultPath: basename(state.output_path) || (isImg ? "output.png" : "output.mp4"),
      filters: isImg ? [FILTERS.outputImage] : [FILTERS.outputVideo],
    });
    if (!out) return;
    const saved = await rpc.saveOutputAs(out);
    if (!saved.ok) {
      pushStatus(saved.error ?? t("action.failedSave"));
      return;
    }
    if (saved.state) setState(saved.state);
    pushStatus(t("action.saved"));
  };

  const onReveal = async () => {
    const r = await rpc.revealOutput();
    if (!r.ok) pushStatus(r.error ?? t("action.failedShow"));
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 bg-bg-soft/40 px-4 py-3">
      <div className="min-w-0 flex-1 text-xs text-zinc-500">
        {processing ? (
          <div className="max-w-[360px]">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="truncate text-accent">
                {percent == null ? t("action.generating") : t("stage.progress")}
              </span>
              {percent == null ? null : (
                <span className="font-mono text-zinc-400">{percent}%</span>
              )}
            </div>
            {percent == null ? null : (
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
          </div>
        ) : hasOutput ? (
          <span className="block max-w-[280px] truncate" title={state.output_path ?? ""}>
            {basename(state.output_path)}
          </span>
        ) : hasMedia ? (
          t("action.ready")
        ) : (
          t("action.noTarget")
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {hasOutput ? (
          <>
            <Tooltip content={t("action.saveCopy")}>
              <button
                onClick={onSaveAs}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
              >
                <Save size={14} />
                {t("action.saveAs")}
              </button>
            </Tooltip>
            <Tooltip content={t("action.showOutput")}>
              <button
                onClick={onReveal}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
              >
                <FolderOpen size={14} />
                {t("action.show")}
              </button>
            </Tooltip>
          </>
        ) : null}

        {hasMedia ? (
          <Tooltip content={t("action.previewTip")}>
            <button
              onClick={onPreview}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
            >
              <Eye size={14} />
              {t("action.preview")}
            </button>
          </Tooltip>
        ) : null}

        {stopActive ? (
          <Tooltip content={t("action.stopTip")}>
            <button
              onClick={onStop}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-danger/30 bg-danger/15 px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/25"
            >
              <Square size={13} />
              {t("action.stop")}
            </button>
          </Tooltip>
        ) : null}

        <Tooltip
          content={
            !hasMedia
              ? t("action.pickMediaTip")
              : processing
              ? t("action.processingTip")
              : t("action.generateOutput")
          }
        >
          <button
            onClick={onStart}
            disabled={!canStart}
            className={cx(
              "inline-flex min-w-[148px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition",
              canStart
                ? "bg-gradient-to-br from-[#6ee7b7] to-[#7dd3fc] text-zinc-950 hover:brightness-105 active:scale-[0.99]"
                : "cursor-not-allowed bg-white/5 text-zinc-500"
            )}
          >
            <Play size={13} />
            {processing ? t("action.running") : t("action.generate")}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
