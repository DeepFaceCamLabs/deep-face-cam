import * as RTooltip from "@radix-ui/react-tooltip";
import { ReactNode } from "react";

interface Props {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delayDuration?: number;
}

export function Tooltip({ content, children, side = "top", delayDuration = 200 }: Props) {
  return (
    <RTooltip.Provider delayDuration={delayDuration}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
        <RTooltip.Portal>
          <RTooltip.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-xs rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-100 shadow-xl backdrop-blur"
          >
            {content}
            <RTooltip.Arrow className="fill-zinc-900/95" />
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  );
}
