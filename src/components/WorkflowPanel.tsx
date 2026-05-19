import { Camera, Images, Video } from "lucide-react";
import { ActionBar } from "./ActionBar";
import { CameraCard } from "./CameraCard";
import { MediaPicker } from "./MediaPicker";
import { Stage } from "./Stage";
import { cx } from "@/lib/cx";
import { useI18n } from "@/i18n";

export type WorkflowMode = "file" | "live";

interface Props {
  mode: WorkflowMode;
  onModeChange: (mode: WorkflowMode) => void;
}

export function WorkflowPanel({ mode, onModeChange }: Props) {
  const { t } = useI18n();

  return (
    <section className="grid min-h-[560px] gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="card flex min-h-0 flex-col overflow-hidden">
        <div className="border-b border-white/5 p-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/5 bg-white/[0.03] p-1">
            <button
              onClick={() => onModeChange("file")}
              className={cx(
                "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                mode === "file"
                  ? "bg-white/10 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-200"
              )}
            >
              <Images size={16} />
              {t("workflow.mode.file")}
            </button>
            <button
              onClick={() => onModeChange("live")}
              className={cx(
                "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                mode === "live"
                  ? "bg-white/10 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-200"
              )}
            >
              <Video size={16} />
              {t("workflow.mode.live")}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {mode === "file" ? (
            <div className="grid gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Images size={16} className="text-accent" />
                {t("workflow.media")}
              </div>
              <MediaPicker variant="stacked" />
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Camera size={16} className="text-accent" />
                {t("workflow.liveSetup")}
              </div>
              <MediaPicker variant="sourceOnly" />
              <CameraCard variant="panel" />
            </div>
          )}
        </div>
      </aside>

      <section className="card flex min-h-[420px] min-w-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/12 text-accent">
              {mode === "file" ? <Images size={17} /> : <Camera size={17} />}
            </div>
            <div className="truncate text-sm font-semibold text-zinc-100">
              {mode === "file"
                ? t("workflow.result")
                : t("workflow.livePreview")}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 p-3">
          <Stage workflowMode={mode} />
        </div>

        {mode === "file" ? <ActionBar /> : null}
      </section>
    </section>
  );
}
