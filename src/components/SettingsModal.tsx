import { Dialog } from "./Dialog";
import { Switch } from "./Switch";
import { Slider } from "./Slider";
import { useUi } from "@/lib/store";
import { rpc } from "@/rpc/client";
import { Tooltip } from "./Tooltip";
import { useI18n } from "@/i18n";
import { LanguageSelect } from "./LanguageSelect";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ENCODERS = ["libx264", "libx265", "libvpx-vp9"];

export function SettingsModal({ open, onClose }: Props) {
  const { t } = useI18n();
  const state = useUi((s) => s.state);
  const patch = useUi((s) => s.patchState);
  if (!state) return null;

  const setBool = async (k: any, v: boolean) => {
    patch({ [k]: v });
    await rpc.setState({ [k]: v });
  };
  const setNum = async (k: any, v: number) => {
    patch({ [k]: v });
    await rpc.setState({ [k]: v });
  };
  const setStr = async (k: any, v: string) => {
    patch({ [k]: v });
    await rpc.setState({ [k]: v });
  };
  const setProviders = async (next: string[]) => {
    patch({ execution_providers: next });
    await rpc.setState({ execution_providers: next });
  };

  const toggleProvider = (p: string) => {
    const curr = state.execution_providers;
    const has = curr.includes(p);
    setProviders(has ? curr.filter((x) => x !== p) : [...curr, p]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={t("settings.title")}
      description={t("settings.description")}
      size="lg"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4">
          <div className="space-y-2">
            <h4 className="label">{t("settings.general")}</h4>
            <div className="space-y-1.5">
              <div className="text-sm text-zinc-300">
                {t("settings.languageHint")}
              </div>
              <LanguageSelect />
            </div>
          </div>

          <h4 className="label pt-2">{t("settings.execution")}</h4>
          <div className="flex flex-wrap gap-2">
            {state.available_providers?.length ? (
              state.available_providers.map((p) => (
                <button
                  key={p}
                  onClick={() => toggleProvider(p)}
                  className={
                    "rounded-full border px-3 py-1 text-xs " +
                    (state.execution_providers.includes(p)
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]")
                  }
                >
                  {p}
                </button>
              ))
            ) : (
              <span className="text-xs text-zinc-500">
                {t("settings.providersNone")}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">
                {t("settings.executionThreads")}
              </span>
              <span className="text-xs text-zinc-500">
                {state.execution_threads ?? t("settings.auto")}
              </span>
            </div>
            <Slider
              min={1}
              max={32}
              step={1}
              value={state.execution_threads ?? 4}
              onValueChange={(v) => setNum("execution_threads", v)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">
                {t("settings.maxMemory")}
              </span>
              <span className="text-xs text-zinc-500">
                {state.max_memory ?? t("settings.auto")}
              </span>
            </div>
            <Slider
              min={1}
              max={64}
              step={1}
              value={state.max_memory ?? 4}
              onValueChange={(v) => setNum("max_memory", v)}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h4 className="label">{t("settings.videoOutput")}</h4>
          <div className="flex flex-wrap gap-1.5">
            {ENCODERS.map((e) => (
              <button
                key={e}
                onClick={() => setStr("video_encoder", e)}
                className={
                  "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition " +
                  (state.video_encoder === e
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-white/5 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]")
                }
              >
                {e}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">
                {t("settings.videoQuality")}
              </span>
              <span className="text-xs text-zinc-500">{state.video_quality}</span>
            </div>
            <Slider
              min={0}
              max={51}
              step={1}
              value={state.video_quality}
              onValueChange={(v) => setNum("video_quality", v)}
            />
          </div>

          <h4 className="label pt-2">{t("settings.interpolation")}</h4>
          <Tooltip content={t("settings.enableTemporal")}>
            <label className="flex items-center justify-between gap-2">
              <span className="text-sm text-zinc-300">
                {t("settings.enableTemporal")}
              </span>
              <Switch
                checked={state.enable_interpolation}
                onCheckedChange={(v) => setBool("enable_interpolation", v)}
              />
            </label>
          </Tooltip>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">
                {t("settings.currentFrameWeight")}
              </span>
              <span className="text-xs text-zinc-500">
                {state.interpolation_weight.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={state.interpolation_weight}
              onValueChange={(v) => setNum("interpolation_weight", v)}
              formatValue={(v) => v.toFixed(2)}
            />
          </div>
        </section>
      </div>
    </Dialog>
  );
}
