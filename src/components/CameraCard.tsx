import { useEffect, useState } from "react";
import { Camera, Square, Video } from "lucide-react";
import { cx } from "@/lib/cx";
import { useUi } from "@/lib/store";
import { rpc } from "@/rpc/client";
import { Tooltip } from "./Tooltip";
import { useI18n } from "@/i18n";
import {
  ensureCameraAccess,
  normalizeCameraStartError,
  showCameraWarning,
} from "@/lib/cameraAccess";

interface Props {
  variant?: "compact" | "panel";
}

export function CameraCard({ variant = "compact" }: Props) {
  const { t } = useI18n();
  const state = useUi((s) => s.state);
  const setModal = useUi((s) => s.setModal);
  const setStageMode = useUi((s) => s.setStageMode);
  const setMapping = useUi((s) => s.setMapping);
  const pushStatus = useUi((s) => s.pushStatus);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<number>(0);

  useEffect(() => {
    if (state?.cameras?.length && selected >= state.cameras.length) {
      setSelected(0);
    }
  }, [state?.cameras?.length, selected]);

  const refresh = async () => {
    setRefreshing(true);
    const list = await rpc.listCameras();
    if (list?.length) {
      useUi.getState().patchState({ cameras: list });
    }
    setRefreshing(false);
  };

  const cams = state?.cameras ?? [];
  const noCam = cams.length === 0 || cams[0]?.disabled;
  const liveRunning = Boolean(state?.live_running);
  const disabled = noCam || state?.processing || liveRunning;

  const requestCameraAccess = async () => {
    const result = await ensureCameraAccess({
      denied: t("camera.permissionDenied"),
      unavailable: t("camera.permissionUnavailable"),
      busy: t("camera.permissionBusy"),
      failed: t("camera.permissionFailed"),
    });
    if (!result.ok) {
      const error = result.error ?? t("camera.startFailed");
      pushStatus(error);
      await showCameraWarning(t("camera.permissionTitle"), error);
      return false;
    }
    return true;
  };

  const onLive = async () => {
    if (disabled) return;
    const camIdx = cams[selected]?.index ?? 0;
    if (state?.map_faces) {
      await rpc.mappingReset();
      const m = await rpc.mappingAdd();
      setMapping(m.map);
      (window as any).__liveCameraIndex = camIdx;
      (window as any).__mapperMode = "live";
      setModal("mapping");
      return;
    }
    if (!state?.source_path) {
      pushStatus(t("camera.selectSourceFirst"));
      return;
    }
    if (!(await requestCameraAccess())) return;
    const r = await rpc.startLive(camIdx);
    if (!r.ok) {
      const error = normalizeCameraStartError(
        r.error,
        t("camera.startFailed"),
        t("camera.openFailedHelp")
      );
      pushStatus(error);
      await showCameraWarning(t("camera.permissionTitle"), error);
      return;
    }
    setStageMode("live");
  };

  const onStop = async () => {
    await rpc.stopLive().catch(() => undefined);
    setStageMode("idle");
  };

  if (variant === "panel") {
    return (
      <div className="grid gap-3 rounded-lg border border-white/5 bg-white/[0.025] p-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Camera size={16} className="text-accent" />
            {t("camera.camera")}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr),auto] gap-2">
            <select
              className="w-full rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-accent/60"
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
              disabled={cams.length === 0}
            >
              {cams.length === 0 ? (
                <option>{t("camera.noCameras")}</option>
              ) : null}
              {cams.map((c, i) => (
                <option key={c.index} value={i}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100 disabled:opacity-50"
            >
              {refreshing ? "..." : t("camera.rescan")}
            </button>
          </div>
        </div>

        <div className="grid gap-2">
          {liveRunning ? (
            <button
              onClick={onStop}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-danger/30 bg-danger/15 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/25"
            >
              <Square size={14} />
              {t("camera.stopLive")}
            </button>
          ) : null}
          <Tooltip
            content={
              noCam
                ? t("camera.noCamera")
                : !state?.source_path
                ? t("camera.pickSourceFirst")
                : t("camera.startTip")
            }
          >
            <button
              onClick={onLive}
              disabled={disabled}
              className={cx(
                "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                !disabled
                  ? "bg-gradient-to-br from-[#6ee7b7] to-[#7dd3fc] text-zinc-950 hover:brightness-105 active:scale-[0.99]"
                  : "cursor-not-allowed bg-white/5 text-zinc-500"
              )}
            >
              <Video size={15} />
              {state?.source_path
                ? t("camera.startPreview")
                : t("camera.chooseFaceFirst")}
            </button>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Camera size={14} className="text-zinc-500" />
      <select
        className="flex-1 min-w-0 rounded-lg border border-white/5 bg-white/5 px-2.5 py-1.5 text-[13px] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-accent/60"
        value={selected}
        onChange={(e) => setSelected(Number(e.target.value))}
        disabled={cams.length === 0}
      >
        {cams.length === 0 ? <option>{t("camera.noCameras")}</option> : null}
        {cams.map((c, i) => (
          <option key={c.index} value={i}>
            {c.name}
          </option>
        ))}
      </select>
      <Tooltip content={t("camera.rescanTip")}>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100 disabled:opacity-50"
        >
          {refreshing ? "…" : t("camera.rescan")}
        </button>
      </Tooltip>
      <Tooltip
        content={
          noCam
            ? t("camera.noCamera")
            : !state?.source_path
            ? t("camera.pickSourceFirst")
            : t("camera.startTip")
        }
      >
        <button
          onClick={onLive}
          disabled={disabled}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition",
            !disabled
              ? "bg-gradient-to-br from-[#6ee7b7] to-[#7dd3fc] text-zinc-950 shadow-[0_8px_30px_-10px_rgba(110,231,183,0.55)] hover:brightness-105 active:scale-[0.99]"
              : "cursor-not-allowed bg-white/5 text-zinc-500"
          )}
        >
          <Video size={14} />
          {t("workflow.mode.live")}
        </button>
      </Tooltip>
    </div>
  );
}
