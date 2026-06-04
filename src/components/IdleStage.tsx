import { ImagePlus, Loader2, Sparkles } from "lucide-react";
import { useUi } from "@/lib/store";
import type { WorkflowMode } from "./WorkflowPanel";
import { useI18n } from "@/i18n";

interface Props {
  workflowMode: WorkflowMode;
}

export function IdleStage({ workflowMode }: Props) {
  const { t } = useI18n();
  const state = useUi((s) => s.state);
  const progress = useUi((s) => s.processingProgress);
  const hasMedia = Boolean(state?.source_path && state?.target_path);
  const liveReady = workflowMode === "live" && Boolean(state?.source_path);
  const processing = Boolean(state?.processing);
  const percent =
    processing && progress?.ratio != null
      ? Math.max(0, Math.min(100, Math.round(progress.ratio * 100)))
      : null;
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/5 bg-white/[0.03] text-zinc-400">
          {processing ? (
            <Loader2 size={19} className="animate-spin text-accent" />
          ) : hasMedia || liveReady ? (
            <Sparkles size={19} />
          ) : (
            <ImagePlus size={19} />
          )}
        </div>
        <div className="text-sm font-medium text-zinc-200">
          {processing
            ? t("stage.generating")
            : hasMedia || liveReady
            ? t("stage.ready")
            : workflowMode === "live"
            ? t("stage.noCameraFeed")
            : t("stage.noMedia")}
        </div>
        {processing && percent != null ? (
          <div className="w-56">
            <div className="mb-1 flex justify-between text-[11px] text-zinc-500">
              <span>{t("stage.progress")}</span>
              <span className="font-mono">{percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
