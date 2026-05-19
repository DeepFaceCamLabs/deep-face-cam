import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import enUS from "./locales/en-US.json";
import zhCN from "./locales/zh-CN.json";
import jaJP from "./locales/ja-JP.json";
import koKR from "./locales/ko-KR.json";
import esES from "./locales/es-ES.json";
import frFR from "./locales/fr-FR.json";
import deDE from "./locales/de-DE.json";
import ptBR from "./locales/pt-BR.json";
import ruRU from "./locales/ru-RU.json";

const STORAGE_KEY = "deep-face-cam.locale";

export const SUPPORTED_LOCALES = [
  "zh-CN",
  "en-US",
  "ja-JP",
  "ko-KR",
  "es-ES",
  "fr-FR",
  "de-DE",
  "pt-BR",
  "ru-RU",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
type Messages = Record<string, string>;

const messages: Record<Locale, Messages> = {
  "zh-CN": zhCN,
  "en-US": enUS,
  "ja-JP": jaJP,
  "ko-KR": koKR,
  "es-ES": esES,
  "fr-FR": frFR,
  "de-DE": deDE,
  "pt-BR": ptBR,
  "ru-RU": ruRU,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function normalizeLocale(value: string | null | undefined): Locale {
  const raw = value?.trim();
  if (!raw) return "en-US";

  const exact = SUPPORTED_LOCALES.find(
    (locale) => locale.toLowerCase() === raw.toLowerCase()
  );
  if (exact) return exact;

  const language = raw.toLowerCase().split("-")[0];
  if (language === "zh") return "zh-CN";
  if (language === "ja") return "ja-JP";
  if (language === "ko") return "ko-KR";
  if (language === "es") return "es-ES";
  if (language === "fr") return "fr-FR";
  if (language === "de") return "de-DE";
  if (language === "pt") return "pt-BR";
  if (language === "ru") return "ru-RU";
  return "en-US";
}

function initialLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLocale(stored);
  } catch {
    // ignore storage access failures
  }
  return normalizeLocale(window.navigator.language);
}

function formatMessage(
  template: string,
  values?: Record<string, string | number>
) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    values[key] === undefined ? `{${key}}` : String(values[key])
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore storage access failures
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) => {
      const template =
        messages[locale][key] ?? messages["en-US"][key] ?? key;
      return formatMessage(template, values);
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return value;
}

export function getLocaleName(locale: Locale) {
  return messages[locale]["language.name"] ?? locale;
}
