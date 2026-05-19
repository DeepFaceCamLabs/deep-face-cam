import { useMemo } from "react";
import {
  Image as ImageIcon,
  Video,
  ArrowLeftRight,
  Plus,
  Shuffle,
  X,
} from "lucide-react";
import { cx } from "@/lib/cx";
import { rpc } from "@/rpc/client";
import { useUi } from "@/lib/store";
import { Tooltip } from "./Tooltip";
import { FILTERS, pickFile } from "@/lib/dialog";
import { useI18n } from "@/i18n";

const VIDEO_EXTS = ["mp4", "mkv", "mov", "avi", "webm"];

function basename(p: string | null) {
  if (!p) return "";
  return p.split(/[\\/]/).pop() ?? p;
}
function ext(p: string | null) {
  if (!p) return "";
  return (p.split(".").pop() ?? "").toLowerCase();
}
function isVideo(p: string | null) {
  if (!p) return false;
  return VIDEO_EXTS.includes(ext(p));
}

interface DropProps {
  label: string;
  hint: string;
  path: string | null;
  kind: "source" | "target";
  onPick: () => void;
  onClear: () => void;
  extraAction?: { icon: React.ReactNode; tip: string; onClick: () => void };
}

function DropCard({
  label,
  hint,
  path,
  kind,
  onPick,
  onClear,
  extraAction,
}: DropProps) {
  const { t } = useI18n();
  const liveKey = useUi((s) => s.liveKey);
  const url = useMemo(() => {
    if (!path) return null;
    const endpoint = isVideo(path) ? "video_thumb" : "thumb";
    return `${rpc.httpBase}/${endpoint}?path=${encodeURIComponent(
      path
    )}&size=360&_=${liveKey}`;
  }, [path, liveKey]);

  return (
    <div
      onClick={path ? undefined : onPick}
      className={cx(
        "group relative flex aspect-[4/3] min-h-[172px] w-full flex-col items-center justify-center overflow-hidden rounded-lg border bg-bg-soft/60 transition",
        path
          ? "border-white/10"
          : "border-dashed border-white/10 hover:border-accent/50 hover:bg-bg-soft/80"
      )}
    >
      {path && url ? (
        <>
          <img
            src={url}
            alt={label}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) =>
              ((e.currentTarget as HTMLImageElement).style.display = "none")
            }
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
            <div className="truncate text-xs text-zinc-100" title={path}>
              {basename(path)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">
              {isVideo(path) ? t("media.video") : t("media.image")}
            </div>
          </div>
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Tooltip content={t("media.replace")}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPick();
                }}
                className="rounded-md bg-black/60 p-1.5 text-zinc-200 backdrop-blur transition hover:bg-black/80"
                aria-label={t("media.replace")}
              >
                <ImageIcon size={13} />
              </button>
            </Tooltip>
            <Tooltip content={t("media.clear")}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="rounded-md bg-black/60 p-1.5 text-zinc-200 backdrop-blur transition hover:bg-danger/80"
                aria-label={t("media.clear")}
              >
                <X size={13} />
              </button>
            </Tooltip>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-[#6ee7b7] to-[#7dd3fc] text-zinc-950 shadow-[0_8px_30px_-10px_rgba(110,231,183,0.55)] transition group-hover:scale-105">
              <Plus size={24} strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-zinc-200">{label}</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">{hint}</div>
            </div>
          </div>
          {extraAction ? (
            <div className="absolute bottom-3 right-3">
              <Tooltip content={extraAction.tip}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    extraAction.onClick();
                  }}
                  className="rounded-md border border-white/5 bg-bg-card/80 p-1.5 text-zinc-400 backdrop-blur transition hover:border-accent/40 hover:text-accent"
                  aria-label={extraAction.tip}
                >
                  {extraAction.icon}
                </button>
              </Tooltip>
            </div>
          ) : null}
          {kind === "target" ? (
            <div className="absolute bottom-3 left-3 text-[10px] uppercase tracking-wider text-zinc-600">
              {t("media.targetTypes")}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

interface MediaPickerProps {
  variant?: "file" | "sourceOnly" | "stacked";
}

export function MediaPicker({ variant = "file" }: MediaPickerProps) {
  const { t } = useI18n();
  const state = useUi((s) => s.state);
  const setState = useUi((s) => s.setState);
  const setStageMode = useUi((s) => s.setStageMode);
  const pushStatus = useUi((s) => s.pushStatus);
  const bumpLive = useUi((s) => s.bumpLive);

  const onPickSource = async () => {
    const p = await pickFile({
      title: t("media.selectFaceDialog"),
      filters: [FILTERS.image],
    });
    if (!p) return;
    const r = await rpc.setSource(p);
    if (!r.ok) {
      pushStatus(r.error ?? t("media.failedSetSource"));
      return;
    }
    setState(r.state);
    setStageMode("idle");
    bumpLive();
  };

  const onPickTarget = async () => {
    const p = await pickFile({
      title: t("media.selectTargetDialog"),
      filters: [FILTERS.media, FILTERS.image, FILTERS.video],
    });
    if (!p) return;
    const r = await rpc.setTarget(p);
    if (!r.ok) {
      pushStatus(r.error ?? t("media.failedSetTarget"));
      return;
    }
    setState(r.state);
    setStageMode("idle");
    bumpLive();
  };

  const onClearSource = async () => {
    const r = await rpc.setSource(null);
    if (r.ok) setState(r.state);
    setStageMode("idle");
    bumpLive();
  };

  const onClearTarget = async () => {
    const r = await rpc.setTarget(null);
    if (r.ok) setState(r.state);
    setStageMode("idle");
    bumpLive();
  };

  const onRandomFace = async () => {
    pushStatus(t("media.fetchingRandom"));
    const r = await rpc.randomFace();
    if (!r.ok) {
      pushStatus(r.error ?? t("media.failed"));
      return;
    }
    if (r.state) setState(r.state);
    setStageMode("idle");
    bumpLive();
  };

  const onSwap = async () => {
    const r = await rpc.swapPaths();
    if (!r.ok) pushStatus(r.error ?? t("media.cannotSwap"));
    else {
      setState(r.state);
      setStageMode("idle");
      bumpLive();
    }
  };

  const canSwap = Boolean(state?.source_path && state?.target_path);

  if (variant === "sourceOnly") {
    return (
      <div className="w-full">
        <DropCard
          label={t("media.sourceFace")}
          hint={t("media.chooseImage")}
          path={state?.source_path ?? null}
          kind="source"
          onPick={onPickSource}
          onClear={onClearSource}
          extraAction={{
            icon: <Shuffle size={13} />,
            tip: t("media.randomFace"),
            onClick: onRandomFace,
          }}
        />
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className="grid gap-3">
        <DropCard
          label={t("media.sourceFace")}
          hint={t("media.chooseImage")}
          path={state?.source_path ?? null}
          kind="source"
          onPick={onPickSource}
          onClear={onClearSource}
          extraAction={{
            icon: <Shuffle size={13} />,
            tip: t("media.randomFaceLong"),
            onClick: onRandomFace,
          }}
        />

        <Tooltip
          content={canSwap ? t("media.swapTip") : t("media.pickBothFirst")}
        >
          <button
            onClick={onSwap}
            disabled={!canSwap}
            className={cx(
              "mx-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-medium transition",
              canSwap
                ? "border-white/10 bg-white/5 text-zinc-200 hover:border-accent/40 hover:text-accent"
                : "cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-600"
            )}
          >
            <ArrowLeftRight size={15} />
            {t("media.swap")}
          </button>
        </Tooltip>

        <DropCard
          label={t("media.target")}
          hint={t("media.imageOrVideo")}
          path={state?.target_path ?? null}
          kind="target"
          onPick={onPickTarget}
          onClear={onClearTarget}
        />
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-[600px] grid-cols-[minmax(0,1fr),auto,minmax(0,1fr)] items-center gap-3">
      <DropCard
        label={t("media.sourceFace")}
        hint={t("media.chooseImage")}
        path={state?.source_path ?? null}
        kind="source"
        onPick={onPickSource}
        onClear={onClearSource}
        extraAction={{
          icon: <Shuffle size={13} />,
          tip: t("media.randomFaceLong"),
          onClick: onRandomFace,
        }}
      />

      <Tooltip content={canSwap ? t("media.swapTip") : t("media.pickBothFirst")}>
        <button
          onClick={onSwap}
          disabled={!canSwap}
          className={cx(
            "flex h-10 w-10 items-center justify-center rounded-full border transition",
            canSwap
              ? "border-white/10 bg-white/5 text-zinc-200 hover:border-accent/40 hover:text-accent"
              : "cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-600"
          )}
          aria-label={t("media.swap")}
        >
          <ArrowLeftRight size={16} />
        </button>
      </Tooltip>

      <DropCard
        label={t("media.target")}
        hint={t("media.imageOrVideo")}
        path={state?.target_path ?? null}
        kind="target"
        onPick={onPickTarget}
        onClear={onClearTarget}
      />
    </div>
  );
}
