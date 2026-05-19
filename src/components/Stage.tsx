import { useUi } from "@/lib/store";
import { IdleStage } from "./IdleStage";
import { LiveStage } from "./LiveStage";
import { OutputStage } from "./OutputStage";
import { PreviewStage } from "./PreviewStage";
import type { WorkflowMode } from "./WorkflowPanel";

interface Props {
  workflowMode: WorkflowMode;
}

export function Stage({ workflowMode }: Props) {
  const stageMode = useUi((s) => s.stageMode);
  return (
    <div className="relative h-full min-h-[260px] overflow-hidden rounded-lg border border-white/5 bg-bg-card/40">
      <div className="absolute inset-0">
        {stageMode === "live" ? (
          <LiveStage />
        ) : stageMode === "preview" ? (
          <PreviewStage />
        ) : stageMode === "output" ? (
          <OutputStage />
        ) : (
          <IdleStage workflowMode={workflowMode} />
        )}
      </div>
    </div>
  );
}
