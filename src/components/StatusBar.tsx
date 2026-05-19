import { useUi } from "@/lib/store";
import { CheckCircle2, Loader2, AlertTriangle, Plug, PlugZap } from "lucide-react";
import { useI18n } from "@/i18n";

export function StatusBar() {
  const { t } = useI18n();
  const log = useUi((s) => s.statusLog);
  const connected = useUi((s) => s.connected);
  const processing = useUi((s) => s.state?.processing ?? false);
  const last =
    log[log.length - 1] ??
    (connected ? t("status.ready") : t("status.connecting"));

  const isError = /(fail|error|ignored|not supported)/i.test(last);

  return (
    <div className="flex items-center gap-3 text-xs text-zinc-400">
      <div className="flex items-center gap-1.5">
        {connected ? (
          <PlugZap size={14} className="text-ok" />
        ) : (
          <Plug size={14} className="text-zinc-500" />
        )}
        <span className="font-mono">
          {connected ? t("status.connected") : t("status.offline")}
        </span>
      </div>
      <div className="h-3 w-px bg-white/10" />
      <div className="flex min-w-0 items-center gap-2">
        {processing ? (
          <Loader2 size={14} className="animate-spin text-accent" />
        ) : isError ? (
          <AlertTriangle size={14} className="text-danger" />
        ) : (
          <CheckCircle2 size={14} className="text-ok/80" />
        )}
        <span className="truncate" title={last}>
          {last}
        </span>
      </div>
    </div>
  );
}
