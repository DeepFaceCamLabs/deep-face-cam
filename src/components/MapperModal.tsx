import { Dialog } from "./Dialog";
import { useUi } from "@/lib/store";
import { rpc } from "@/rpc/client";
import { FILTERS, pickFile } from "@/lib/dialog";
import { Plus, Trash2, Check, ImagePlus } from "lucide-react";
import { useI18n } from "@/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "video" | "live"; // "video" = image/video target; "live" = webcam
}

export function MapperModal({ open, onClose, mode }: Props) {
  const { t } = useI18n();
  const map = useUi((s) => s.mapping);
  const setMap = useUi((s) => s.setMapping);
  const pushStatus = useUi((s) => s.pushStatus);
  const setState = useUi((s) => s.setState);
  const setStageMode = useUi((s) => s.setStageMode);

  const pickAndSet = async (row: number, kind: "source" | "target") => {
    const p = await pickFile({
      title:
        kind === "source"
          ? t("mapping.selectSourceDialog")
          : t("mapping.selectTargetDialog"),
      filters: [FILTERS.image],
    });
    if (!p) return;
    const r =
      kind === "source"
        ? await rpc.mappingSetSource(row, p)
        : await rpc.mappingSetTarget(row, p);
    if (!r.ok) {
      pushStatus(r.error ?? t("mapping.failed"));
      return;
    }
    setMap(r.map ?? []);
  };

  const onAdd = async () => {
    const r = await rpc.mappingAdd();
    setMap(r.map);
  };

  const onClear = async () => {
    const r = await rpc.mappingClear();
    setMap(r.map);
    pushStatus(t("mapping.clearStatus"));
  };

  const onSubmit = async () => {
    const valid = await rpc.mappingValid();
    if (!valid) {
      pushStatus(t("mapping.validRequired"));
      return;
    }
    if (mode === "live") {
      const r = await rpc.mappingSimplify();
      if (!r.ok) {
        pushStatus(r.error ?? t("mapping.submitFailed"));
        return;
      }
      pushStatus(t("mapping.submitted"));
      const camIdx = (window as any).__liveCameraIndex ?? 0;
      const live = await rpc.startLive(camIdx);
      if (!live.ok) {
        pushStatus(live.error ?? t("camera.startFailed"));
        return;
      }
      onClose();
      setStageMode("live");
      return;
    }

    setStageMode("idle");
    pushStatus(t("action.generating"));
    const s = await rpc.start(true);
    if (!s.ok) pushStatus(s.error ?? t("mapping.failed"));
    if (s.state) setState(s.state);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={
        mode === "live" ? t("mapping.title.live") : t("mapping.title.video")
      }
      description={
        mode === "live"
          ? t("mapping.description.live")
          : t("mapping.description.video")
      }
      size="lg"
    >
      <div className="space-y-2">
        {map.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-400">
            {mode === "live"
              ? t("mapping.empty.live")
              : t("mapping.empty.video")}
          </div>
        ) : null}

        {map.map((m) => (
          <div
            key={m.id}
            className="grid grid-cols-[1fr,84px,30px,84px,1fr] items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3"
          >
            <button
              onClick={() => pickAndSet(m.id, "source")}
              className="btn-secondary justify-start"
            >
              <ImagePlus size={14} />
              {m.source ? t("mapping.changeSource") : t("mapping.selectSource")}
            </button>

            <div className="aspect-square overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10">
              {m.source ? (
                <img
                  src={m.source}
                  className="h-full w-full object-cover"
                  alt={`source-${m.id}`}
                  draggable={false}
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-[10px] uppercase tracking-wider text-zinc-500">
                  S-{m.id}
                </div>
              )}
            </div>

            <div className="text-center text-zinc-500">×</div>

            <div className="aspect-square overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10">
              {m.target ? (
                <img
                  src={m.target}
                  className="h-full w-full object-cover"
                  alt={`target-${m.id}`}
                  draggable={false}
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-[10px] uppercase tracking-wider text-zinc-500">
                  T-{m.id}
                </div>
              )}
            </div>

            {mode === "live" ? (
              <button
                onClick={() => pickAndSet(m.id, "target")}
                className="btn-secondary justify-start"
              >
                <ImagePlus size={14} />
                {m.target
                  ? t("mapping.changeTarget")
                  : t("mapping.selectTarget")}
              </button>
            ) : (
              <div className="text-xs text-zinc-500">
                {t("mapping.autoDetected")}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/5 pt-4">
        <div className="flex gap-2">
          {mode === "live" ? (
            <>
              <button onClick={onAdd} className="btn-secondary">
                <Plus size={14} /> {t("mapping.add")}
              </button>
              <button onClick={onClear} className="btn-ghost text-danger">
                <Trash2 size={14} /> {t("mapping.clear")}
              </button>
            </>
          ) : null}
        </div>
        <button onClick={onSubmit} className="btn-primary">
          <Check size={16} /> {t("mapping.submit")}
        </button>
      </div>
    </Dialog>
  );
}
