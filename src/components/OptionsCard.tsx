import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useUi } from "@/lib/store";
import { rpc } from "@/rpc/client";
import { Switch } from "./Switch";
import { Tooltip } from "./Tooltip";
import { cx } from "@/lib/cx";
import { useI18n } from "@/i18n";

type BoolKeys =
  | "keep_fps"
  | "keep_audio"
  | "keep_frames"
  | "many_faces"
  | "map_faces"
  | "show_fps"
  | "poisson_blend"
  | "color_correction"
  | "nsfw_filter"
  | "live_mirror";

type OptionItem = { key: BoolKeys; labelKey: string; tipKey: string };

const OPTION_GROUPS: Array<{ titleKey: string; items: OptionItem[] }> = [
  {
    titleKey: "options.group.faces",
    items: [
      {
        key: "many_faces",
        labelKey: "options.many_faces.label",
        tipKey: "options.many_faces.tip",
      },
      {
        key: "map_faces",
        labelKey: "options.map_faces.label",
        tipKey: "options.map_faces.tip",
      },
    ],
  },
  {
    titleKey: "options.group.output",
    items: [
      {
        key: "keep_fps",
        labelKey: "options.keep_fps.label",
        tipKey: "options.keep_fps.tip",
      },
      {
        key: "keep_audio",
        labelKey: "options.keep_audio.label",
        tipKey: "options.keep_audio.tip",
      },
      {
        key: "keep_frames",
        labelKey: "options.keep_frames.label",
        tipKey: "options.keep_frames.tip",
      },
    ],
  },
  {
    titleKey: "options.group.live",
    items: [
      {
        key: "live_mirror",
        labelKey: "options.live_mirror.label",
        tipKey: "options.live_mirror.tip",
      },
      {
        key: "show_fps",
        labelKey: "options.show_fps.label",
        tipKey: "options.show_fps.tip",
      },
    ],
  },
  {
    titleKey: "options.group.safety",
    items: [
      {
        key: "poisson_blend",
        labelKey: "options.poisson_blend.label",
        tipKey: "options.poisson_blend.tip",
      },
      {
        key: "color_correction",
        labelKey: "options.color_correction.label",
        tipKey: "options.color_correction.tip",
      },
      {
        key: "nsfw_filter",
        labelKey: "options.nsfw_filter.label",
        tipKey: "options.nsfw_filter.tip",
      },
    ],
  },
];

const ENHANCER_CHOICES = ["None", "GFPGAN", "GPEN-512", "GPEN-256"] as const;

export function OptionsCard() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const state = useUi((s) => s.state);
  const patch = useUi((s) => s.patchState);

  if (!state) return null;

  const setBool = async (key: BoolKeys, value: boolean) => {
    patch({ [key]: value } as any);
    await rpc.setState({ [key]: value } as any);
  };

  const setEnhancer = async (v: (typeof ENHANCER_CHOICES)[number]) => {
    patch({ enhancer: v });
    await rpc.setState({ enhancer: v });
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
              {t("options.title")}
            </span>
            <span className="block truncate text-xs text-zinc-500">
              {t("options.summary")}
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
          <div className="grid gap-4 sm:grid-cols-2">
            {OPTION_GROUPS.map((group) => (
              <section key={group.titleKey} className="space-y-1.5">
                <div className="px-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                  {t(group.titleKey)}
                </div>
                <div className="grid gap-1">
                  {group.items.map((o) => (
                    <Tooltip key={o.key} content={t(o.tipKey)}>
                      <label className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1.5 transition hover:bg-white/[0.03]">
                        <span className="text-[13px] text-zinc-200">
                          {t(o.labelKey)}
                        </span>
                        <Switch
                          checked={Boolean(state[o.key])}
                          onCheckedChange={(v) => setBool(o.key, v)}
                        />
                      </label>
                    </Tooltip>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="space-y-2 border-t border-white/5 pt-4">
            <div className="text-[11px] uppercase tracking-[0.14em] font-medium text-zinc-400">
              {t("options.faceEnhancer")}
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {ENHANCER_CHOICES.map((v) => (
                <button
                  key={v}
                  onClick={() => setEnhancer(v)}
                  className={
                    "rounded-lg border px-2 py-1.5 text-[12px] font-medium transition " +
                    (state.enhancer === v
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-white/5 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]")
                  }
                >
                  {v === "None" ? t("enhancer.none") : v}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
