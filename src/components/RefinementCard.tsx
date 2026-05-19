import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useUi } from "@/lib/store";
import { rpc } from "@/rpc/client";
import { Slider } from "./Slider";
import { Tooltip } from "./Tooltip";
import { cx } from "@/lib/cx";
import { useI18n } from "@/i18n";

export function RefinementCard() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const state = useUi((s) => s.state);
  const patch = useUi((s) => s.patchState);

  if (!state) return null;

  const pushFloat = async (
    k: "opacity" | "sharpness" | "mouth_mask_size",
    v: number
  ) => {
    patch({ [k]: v } as any);
    await rpc.setState({ [k]: v } as any);
  };

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.025]"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
            <SlidersHorizontal size={15} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-zinc-100">
              {t("refinement.title")}
            </span>
            <span className="block truncate text-xs text-zinc-500">
              {t("refinement.summary")}
            </span>
          </span>
        </span>
        <ChevronDown
          size={17}
          className={cx(
            "shrink-0 text-zinc-500 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-white/5 p-4">
          <Tooltip content={t("refinement.blend.tip")}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[13px] text-zinc-200">
                  {t("refinement.blend.label")}
                </div>
                <div className="text-[11px] tabular-nums text-zinc-500">
                  {(state.opacity * 100).toFixed(0)}%
                </div>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={state.opacity}
                onValueChange={(v) => pushFloat("opacity", v)}
                formatValue={(v) => `${Math.round(v * 100)}%`}
              />
            </div>
          </Tooltip>

          <Tooltip content={t("refinement.sharpness.tip")}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[13px] text-zinc-200">
                  {t("refinement.sharpness.label")}
                </div>
                <div className="text-[11px] tabular-nums text-zinc-500">
                  {state.sharpness.toFixed(1)}
                </div>
              </div>
              <Slider
                min={0}
                max={5}
                step={0.1}
                value={state.sharpness}
                onValueChange={(v) => pushFloat("sharpness", v)}
                formatValue={(v) => v.toFixed(1)}
              />
            </div>
          </Tooltip>

          <Tooltip content={t("refinement.mouthMask.tip")}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[13px] text-zinc-200">
                  {t("refinement.mouthMask.label")}
                </div>
                <div className="text-[11px] tabular-nums text-zinc-500">
                  {state.mouth_mask_size.toFixed(0)}
                </div>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={state.mouth_mask_size}
                onValueChange={(v) => pushFloat("mouth_mask_size", v)}
                onPointerDown={() => {
                  if (state.mouth_mask_size > 0)
                    rpc.setState({ show_mouth_mask_box: true });
                }}
                onPointerUp={() => rpc.setState({ show_mouth_mask_box: false })}
                formatValue={(v) => v.toFixed(0)}
              />
            </div>
          </Tooltip>
        </div>
      ) : null}
    </section>
  );
}
