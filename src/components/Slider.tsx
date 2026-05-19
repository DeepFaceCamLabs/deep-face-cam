import * as RSlider from "@radix-ui/react-slider";
import { cx } from "@/lib/cx";
import { useI18n } from "@/i18n";

interface Props {
  value: number;
  onValueChange: (v: number) => void;
  onValueCommit?: (v: number) => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  formatValue?: (v: number) => string;
}

export function Slider({
  value,
  onValueChange,
  onValueCommit,
  onPointerDown,
  onPointerUp,
  min,
  max,
  step = 1,
  disabled,
  className,
  formatValue,
}: Props) {
  const { t } = useI18n();

  return (
    <div className={cx("flex items-center gap-3", className)}>
      <RSlider.Root
        className="relative flex h-5 flex-1 cursor-pointer touch-none select-none items-center"
        value={[value]}
        onValueChange={(v) => onValueChange(v[0]!)}
        onValueCommit={onValueCommit ? (v) => onValueCommit(v[0]!) : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      >
        <RSlider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-white/10">
          <RSlider.Range className="absolute h-full rounded-full bg-gradient-to-r from-[#6ee7b7] to-[#7dd3fc]" />
        </RSlider.Track>
        <RSlider.Thumb
          className={cx(
            "block h-4 w-4 rounded-full border border-white/30 bg-white",
            "shadow-[0_4px_14px_rgba(110,231,183,0.4)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
            "transition-transform hover:scale-110 active:scale-95"
          )}
          aria-label={t("slider.thumb")}
        />
      </RSlider.Root>
      <span className="w-12 text-right font-mono text-xs text-zinc-400 tabular-nums">
        {formatValue ? formatValue(value) : value.toFixed(0)}
      </span>
    </div>
  );
}
