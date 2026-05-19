import { useEffect, useMemo } from "react";
import { Square, Sparkles } from "lucide-react";
import { useUi } from "@/lib/store";
import { rpc } from "@/rpc/client";
import { useI18n } from "@/i18n";

export function LiveStage() {
  const { t } = useI18n();
  const liveRunning = useUi((s) => s.state?.live_running ?? false);
  const liveKey = useUi((s) => s.liveKey);
  const bumpLive = useUi((s) => s.bumpLive);
  const setStageMode = useUi((s) => s.setStageMode);

  useEffect(() => {
    bumpLive();
    return () => {
      rpc.stopLive().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const streamUrl = useMemo(
    () => `${rpc.httpBase}/preview.mjpeg?_=${liveKey}`,
    [liveKey]
  );

  const onStop = async () => {
    await rpc.stopLive().catch(() => undefined);
    setStageMode("idle");
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col items-center justify-center p-4">
      <div className="relative h-full max-h-full w-full max-w-full">
        <div className="relative h-full overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
          <img
            src={streamUrl}
            alt="live"
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
          />
          <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] uppercase tracking-wider text-zinc-100 backdrop-blur">
            <span
              className={
                "h-1.5 w-1.5 rounded-full " +
                (liveRunning ? "bg-red-500 animate-pulse" : "bg-zinc-500")
              }
            />
            {t("stage.live")}
          </div>
          <button
            onClick={onStop}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-3 py-1.5 text-[12px] font-medium text-zinc-100 backdrop-blur transition hover:border-danger/60 hover:bg-danger/40"
          >
            <Square size={13} />
            {t("action.stop")}
          </button>
        </div>
      </div>
      <div className="mt-3 inline-flex items-center gap-2 text-[11px] text-zinc-500">
        <Sparkles size={12} className="text-accent" />
        {t("stage.liveHint")}
      </div>
    </div>
  );
}
