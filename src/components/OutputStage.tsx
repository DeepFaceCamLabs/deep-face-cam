import { FileCheck2 } from "lucide-react";
import { rpc } from "@/rpc/client";
import { useUi } from "@/lib/store";
import { useI18n } from "@/i18n";

const VIDEO_EXTS = ["mp4", "mkv", "mov", "avi", "webm"];

function ext(path: string) {
  return (path.split(".").pop() ?? "").toLowerCase();
}

function basename(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

export function OutputStage() {
  const { t } = useI18n();
  const output = useUi((s) => s.state?.output_path ?? null);

  if (!output) {
    return (
      <div className="grid h-full min-h-[240px] place-items-center p-8 text-sm text-zinc-500">
        {t("stage.noOutput")}
      </div>
    );
  }

  const mediaUrl = `${rpc.httpBase}/media?path=${encodeURIComponent(
    output
  )}`;
  const isVideo = VIDEO_EXTS.includes(ext(output));

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="relative flex-1 min-h-0 overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
        {isVideo ? (
          <video
            src={mediaUrl}
            className="absolute inset-0 h-full w-full object-contain"
            controls
            playsInline
          />
        ) : (
          <img
            src={mediaUrl}
            alt={t("stage.outputAlt")}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
        <div className="pointer-events-none absolute left-3 top-3 inline-flex max-w-[calc(100%-24px)] items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-zinc-100 backdrop-blur">
          <FileCheck2 size={12} className="text-ok" />
          <span className="truncate">{basename(output)}</span>
        </div>
      </div>
    </div>
  );
}
