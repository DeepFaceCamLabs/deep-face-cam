import * as RDialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { useI18n } from "@/i18n";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showClose?: boolean;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  size = "md",
  showClose = true,
}: Props) {
  const { t } = useI18n();

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </RDialog.Overlay>
            <RDialog.Content asChild forceMount>
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                className={cx(
                  "pointer-events-auto",
                  "glass rounded-lg p-6 text-zinc-100 shadow-2xl",
                  "max-h-[90vh] w-full overflow-hidden flex flex-col",
                  size === "sm" && "max-w-[420px]",
                  size === "md" && "max-w-[640px]",
                  size === "lg" && "max-w-[840px]",
                  size === "xl" && "max-w-[1040px]",
                  className
                )}
                initial={{ opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 8 }}
                transition={{ duration: 0.16 }}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {title ? (
                      <RDialog.Title className="text-lg font-semibold tracking-tight">
                        {title}
                      </RDialog.Title>
                    ) : null}
                    {description ? (
                      <RDialog.Description className="mt-1 text-sm text-zinc-400">
                        {description}
                      </RDialog.Description>
                    ) : null}
                  </div>
                  {showClose ? (
                    <RDialog.Close
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-100 transition"
                      aria-label={t("dialog.close")}
                    >
                      <X size={18} />
                    </RDialog.Close>
                  ) : null}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
              </motion.div>
              </div>
            </RDialog.Content>
          </RDialog.Portal>
        ) : null}
      </AnimatePresence>
    </RDialog.Root>
  );
}
