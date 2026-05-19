import * as RSwitch from "@radix-ui/react-switch";
import { cx } from "@/lib/cx";

interface Props {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Switch({ checked, onCheckedChange, disabled, id, className }: Props) {
  return (
    <RSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cx(
        "group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full",
        "border border-white/10 transition-colors duration-200",
        "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#6ee7b7] data-[state=checked]:to-[#7dd3fc]",
        "data-[state=unchecked]:bg-white/10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <RSwitch.Thumb
        className={cx(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md",
          "translate-x-0.5 transition-transform duration-200 ease-out",
          "data-[state=checked]:translate-x-[22px]",
          "data-[state=checked]:shadow-[0_0_18px_rgba(110,231,183,0.55)]"
        )}
      />
    </RSwitch.Root>
  );
}
