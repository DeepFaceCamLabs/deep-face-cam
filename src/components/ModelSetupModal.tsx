import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  HardDrive,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Dialog } from "./Dialog";
import { rpc } from "@/rpc/client";
import type { ModelInfo, ModelStatus, ServerEvent } from "@/rpc/types";
import { useI18n } from "@/i18n";
import { useUi } from "@/lib/store";

type Progress = Record<
  string,
  { bytes: number; total: number; error?: string; done?: boolean }
>;

interface Props {
  open: boolean;
  status: ModelStatus | null;
  onStatusChange: (status: ModelStatus) => void;
  onClose: () => void;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit >= 2 ? 1 : 0)} ${units[unit]}`;
}

function progressRatio(model: ModelInfo, progress: Progress) {
  if (model.present) return 1;
  const item = progress[model.id];
  if (!item) return 0;
  if (item.done) return 1;
  const total = item.total || model.size_bytes || 0;
  return total > 0 ? Math.min(1, item.bytes / total) : 0;
}

export function ModelSetupModal({
  open,
  status,
  onStatusChange,
  onClose,
}: Props) {
  const { t } = useI18n();
  const pushStatus = useUi((s) => s.pushStatus);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<Progress>({});
  const [error, setError] = useState<string | null>(null);

  const allModels = useMemo(() => status?.models ?? [], [status]);
  const requiredModels = useMemo(
    () => status?.models.filter((model) => model.required) ?? [],
    [status]
  );
  const optionalModels = useMemo(
    () => status?.models.filter((model) => !model.required) ?? [],
    [status]
  );
  const missingRequiredModels = requiredModels.filter((model) => !model.present);
  const missingOptionalModels = optionalModels.filter((model) => !model.present);
  const missingModels = allModels.filter((model) => !model.present);
  const missingBytes = missingRequiredModels.reduce(
    (sum, model) => sum + model.size_bytes,
    0
  );
  const missingAllBytes = missingModels.reduce(
    (sum, model) => sum + model.size_bytes,
    0
  );
  const blocking = missingRequiredModels.length > 0;

  useEffect(() => {
    if (!open) return undefined;
    return rpc.on((event: ServerEvent) => {
      if (event.event !== "model_download" || !event.id) return;
      const id = event.id;
      setProgress((current) => {
        const next = { ...current };
        const prev = next[id] ?? { bytes: 0, total: 0 };
        if (event.phase === "model_download_start") {
          next[id] = { bytes: 0, total: event.total ?? prev.total };
        } else if (event.phase === "model_download_progress") {
          next[id] = {
            ...prev,
            bytes: event.bytes ?? prev.bytes,
            total: event.total ?? prev.total,
          };
        } else if (event.phase === "model_download_done") {
          next[id] = { ...prev, done: true };
        } else if (event.phase === "model_download_error") {
          next[id] = { ...prev, error: event.error };
        }
        return next;
      });
    });
  }, [open]);

  const refresh = async () => {
    const next = await rpc.modelStatus(false);
    onStatusChange(next);
    return next;
  };

  const download = async (ids?: string[], requiredOnly = false) => {
    setDownloading(true);
    setError(null);
    setProgress({});
    pushStatus(t("model.downloading"));
    try {
      const result = await rpc.downloadModels(ids, requiredOnly);
      onStatusChange(result.status);
      if (!result.ok || (requiredOnly && result.status.missing_required.length > 0)) {
        const failed = result.results.find((item) => !item.ok);
        throw new Error(failed?.error ?? t("model.downloadFailed"));
      }
      pushStatus(t("model.complete"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("model.downloadFailed");
      setError(message);
      pushStatus(message);
    } finally {
      setDownloading(false);
      await refresh().catch(() => undefined);
    }
  };

  const renderModels = (title: string, models: ModelInfo[]) => {
    if (models.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {title}
        </div>
        {models.map((model) => {
          const ratio = progressRatio(model, progress);
          const item = progress[model.id];
          return (
            <div
              key={model.id}
              className="rounded-lg border border-white/10 bg-bg-soft/60 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-100">
                    {model.filename}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {formatBytes(model.size_bytes)}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-zinc-400">
                  {model.present || item?.done
                    ? t("model.present")
                    : item?.error
                      ? t("model.failed")
                      : downloading && ratio > 0
                        ? `${Math.round(ratio * 100)}%`
                        : t("model.missing")}
                </div>
              </div>
              {!model.present && downloading ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${Math.max(4, Math.round(ratio * 100))}%` }}
                  />
                </div>
              ) : null}
              {item?.error ? (
                <div className="mt-2 text-xs text-danger">{item.error}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !blocking && !downloading) onClose();
      }}
      title={t("model.title")}
      description={blocking ? t("model.description") : t("model.readyDescription")}
      size="md"
      showClose={!blocking && !downloading}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-accent">
              {blocking ? (
                <AlertTriangle size={18} />
              ) : (
                <CheckCircle2 size={18} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-zinc-100">
                {blocking
                  ? t("model.requiredMissing", { count: missingRequiredModels.length })
                  : missingOptionalModels.length > 0
                    ? t("model.optionalMissing", { count: missingOptionalModels.length })
                    : t("model.allReady")}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
                <HardDrive size={13} />
                <span className="truncate" title={status?.models_dir}>
                  {status?.models_dir}
                </span>
              </div>
              {blocking || missingModels.length > 0 ? (
                <div className="mt-2 text-xs text-zinc-400">
                  {blocking
                    ? t("model.totalDownload", { size: formatBytes(missingBytes) })
                    : t("model.totalMissingDownload", {
                        size: formatBytes(missingAllBytes),
                      })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {renderModels(t("model.requiredSection"), requiredModels)}
        {renderModels(t("model.optionalSection"), optionalModels)}

        {error ? (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={refresh}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={15} />
            {t("model.refresh")}
          </button>
          {blocking ? (
            <button
              onClick={() => download(undefined, true)}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {downloading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              {downloading ? t("model.downloading") : t("model.downloadRequired")}
            </button>
          ) : missingModels.length > 0 ? (
            <button
              onClick={() =>
                download(
                  missingModels.map((model) => model.id),
                  false
                )
              }
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {downloading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              {downloading ? t("model.downloading") : t("model.downloadMissing")}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
            >
              {t("model.continue")}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
