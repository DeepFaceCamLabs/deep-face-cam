import { Globe2 } from "lucide-react";
import { getLocaleName, SUPPORTED_LOCALES, useI18n, type Locale } from "@/i18n";
import { cx } from "@/lib/cx";

interface Props {
  compact?: boolean;
}

export function LanguageSelect({ compact = false }: Props) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label
      className={cx(
        "inline-flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] text-zinc-300",
        compact ? "px-2 py-1" : "w-full px-3 py-2"
      )}
    >
      <Globe2 size={compact ? 14 : 16} className="shrink-0 text-zinc-500" />
      <span className={compact ? "sr-only" : "text-sm text-zinc-400"}>
        {t("settings.language")}
      </span>
      <select
        aria-label={t("top.language")}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className={cx(
          "min-w-0 flex-1 bg-transparent text-zinc-100 outline-none",
          compact ? "w-[112px] text-xs" : "text-sm"
        )}
      >
        {SUPPORTED_LOCALES.map((item) => (
          <option key={item} value={item}>
            {getLocaleName(item)}
          </option>
        ))}
      </select>
    </label>
  );
}
