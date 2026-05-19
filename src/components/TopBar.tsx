import { DownloadCloud, Github, Settings } from "lucide-react";
import { useUi } from "@/lib/store";
import { useI18n } from "@/i18n";
import { LanguageSelect } from "./LanguageSelect";

interface Props {
  onOpenSettings: () => void;
  onOpenModels: () => void;
}

export function TopBar({ onOpenSettings, onOpenModels }: Props) {
  const state = useUi((s) => s.state);
  const { t } = useI18n();
  return (
    <header
      data-tauri-drag-region
      className="flex h-11 select-none items-center justify-between border-b border-white/5 bg-bg-soft/40 pl-[88px] pr-3 backdrop-blur"
    >
      <div data-tauri-drag-region className="flex items-center gap-2.5">
        <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-[#6ee7b7] to-[#7dd3fc]" />
        <div data-tauri-drag-region className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold tracking-tight">
            DeepFaceCam
          </span>
          <span className="text-[10px] text-zinc-500">
            {state?.version ? `v${state.version}` : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <LanguageSelect compact />
        <button
          onClick={onOpenModels}
          className="rounded-md p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
          aria-label={t("top.models")}
          title={t("top.models")}
        >
          <DownloadCloud size={15} />
        </button>
        <button
          onClick={onOpenSettings}
          className="rounded-md p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
          aria-label={t("top.settings")}
        >
          <Settings size={15} />
        </button>
        <a
          href="https://github.com/DeepFaceCamLabs/deep-face-cam"
          target="_blank"
          rel="noreferrer"
          className="rounded-md p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
          aria-label={t("top.github")}
        >
          <Github size={15} />
        </a>
      </div>
    </header>
  );
}
