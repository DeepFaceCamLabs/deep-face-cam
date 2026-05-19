import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Slider } from "./Slider";
import { useUi } from "@/lib/store";
import { rpc } from "@/rpc/client";
import { useI18n } from "@/i18n";

export function PreviewStage() {
  const { t } = useI18n();
  const state = useUi((s) => s.state);
  const setStageMode = useUi((s) => s.setStageMode);
  const pushStatus = useUi((s) => s.pushStatus);
  const [frame, setFrame] = useState(0);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const [hasPreview, setHasPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (state?.is_target_video) {
        const c = await rpc.videoFrameCount(state.target_path);
        if (alive) setCount(c);
      } else {
        setCount(0);
      }
      setFrame(0);
      await render(0);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.target_path, state?.is_target_video]);

  const render = async (n: number) => {
    setBusy(true);
    setError(null);
    try {
      const r = await rpc.previewFrame(n);
      if (r?.ok) {
        setHasPreview(true);
        setImgKey((k) => k + 1);
        return;
      }
      const message = r?.error ?? t("stage.previewFailed");
      setError(message);
      pushStatus(message);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("stage.previewFailed");
      setError(message);
      pushStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const onClose = () => setStageMode("idle");

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="relative flex-1 min-h-0 overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
        {hasPreview ? (
          <img
            key={imgKey}
            src={`${rpc.httpBase}/preview.jpg?_=${imgKey}`}
            alt="preview"
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
            onError={() => {
              const message = t("stage.previewFailed");
              setError(message);
              pushStatus(message);
            }}
          />
        ) : null}
        <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] uppercase tracking-wider text-zinc-200 backdrop-blur">
          {t("action.preview")}
        </div>
        <button
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-[12px] font-medium text-zinc-100 backdrop-blur transition hover:border-white/30 hover:bg-black/80"
        >
          <X size={13} />
          {t("stage.close")}
        </button>
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-zinc-200">
            <Loader2 size={18} className="animate-spin" />
            <span className="ml-2 text-sm">{t("stage.rendering")}</span>
          </div>
        ) : null}
        {!busy && error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>
      {state?.is_target_video && count > 0 ? (
        <div className="mt-3 px-1">
          <Slider
            min={0}
            max={Math.max(0, count - 1)}
            value={frame}
            onValueChange={(v) => setFrame(v)}
            onValueCommit={(v) => render(v)}
            formatValue={(v) => `${v} / ${count - 1}`}
          />
        </div>
      ) : null}
    </div>
  );
}
