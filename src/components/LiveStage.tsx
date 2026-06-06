import { useEffect, useMemo } from "react";
import { Loader2, Square, Sparkles } from "lucide-react";
import { useUi } from "@/lib/store";
import { rpc } from "@/rpc/client";
import { useI18n } from "@/i18n";

export function LiveStage() {
  const { t } = useI18n();
  const liveRunning = useUi((s) => s.state?.live_running ?? false);
  const liveStarting = useUi((s) => s.liveStarting);
  const liveStopping = useUi((s) => s.liveStopping);
  const liveKey = useUi((s) => s.liveKey);
  const bumpLive = useUi((s) => s.bumpLive);
  const setStageMode = useUi((s) => s.setStageMode);
  const setLiveStarting = useUi((s) => s.setLiveStarting);
  const setLiveStopping = useUi((s) => s.setLiveStopping);
  const pushStatus = useUi((s) => s.pushStatus);

  useEffect(() => {
    bumpLive();
    return () => {
      const current = useUi.getState();
      if (current.state?.live_running && !current.liveStopping) {
        rpc.stopLive().catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const streamUrl = useMemo(
    () => `${rpc.httpBase}/preview.mjpeg?_=${liveKey}`,
    [liveKey]
  );

  const onStop = async () => {
    if (liveStopping || liveStarting) return;
    setLiveStopping(true);
    setLiveStarting(false);
    pushStatus(t("camera.stoppingLive"));
    try {
      await rpc.stopLive().catch(() => undefined);
      useUi.getState().patchState({ live_running: false });
      setStageMode("idle");
    } finally {
      setLiveStopping(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col items-center justify-center p-4">
      <div className="relative h-full max-h-full w-full max-w-full">
        <div className="relative h-full overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
          {liveRunning && !liveStarting ? (
            <img
              src={streamUrl}
              alt="live"
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 size={28} className="animate-spin text-accent" />
              <div className="text-sm font-medium text-zinc-100">
                {liveStarting ? t("stage.liveStarting") : t("stage.noCameraFeed")}
              </div>
              <div className="max-w-[280px] text-xs leading-relaxed text-zinc-500">
                {liveStarting ? t("stage.liveStartingHint") : t("stage.liveHint")}
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] uppercase tracking-wider text-zinc-100 backdrop-blur">
            <span
              className={
                "h-1.5 w-1.5 rounded-full " +
                (liveRunning && !liveStopping
                  ? "bg-red-500 animate-pulse"
                  : liveStarting
                  ? "bg-accent animate-pulse"
                  : "bg-zinc-500")
              }
            />
            {liveStarting
              ? t("camera.startingLive")
              : liveStopping
              ? t("camera.stoppingLive")
              : t("stage.live")}
          </div>
          <button
            onClick={onStop}
            disabled={liveStarting || liveStopping}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-3 py-1.5 text-[12px] font-medium text-zinc-100 backdrop-blur transition hover:border-danger/60 hover:bg-danger/40"
          >
            {liveStopping ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Square size={13} />
            )}
            {liveStopping ? t("camera.stoppingLive") : t("action.stop")}
          </button>
          {liveStopping ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-sm">
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-sm font-medium text-zinc-100">
                <Loader2 size={16} className="animate-spin text-accent" />
                {t("camera.stoppingLive")}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-3 inline-flex items-center gap-2 text-[11px] text-zinc-500">
        <Sparkles size={12} className="text-accent" />
        {t("stage.liveHint")}
      </div>
    </div>
  );
}
