"use client";

import {
  applyDocumentLocale,
  DEFAULT_LOCALE,
  getLocaleConfig,
  getNextLocale,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  type LocaleConfig,
  type LocaleDirection
} from "@/lib/i18n/config";
import {
  formatMessage,
  getMessages,
  type MessageKey
} from "@/lib/i18n/messages";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

interface LocaleContextValue {
  currentLocale: LocaleConfig;
  direction: LocaleDirection;
  isRtl: boolean;
  setLocale: (locale: string) => void;
  supportedLocales: readonly LocaleConfig[];
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);
const fallbackLocale = getLocaleConfig(DEFAULT_LOCALE);
const fallbackMessages = getMessages(fallbackLocale.code);
const fallbackLocaleContext: LocaleContextValue = {
  currentLocale: fallbackLocale,
  direction: fallbackLocale.direction,
  isRtl: fallbackLocale.direction === "rtl",
  setLocale: () => undefined,
  supportedLocales: SUPPORTED_LOCALES,
  t: (key, values) => formatMessage(fallbackMessages[key], values),
  toggleLocale: () => undefined
};

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const config = applyDocumentLocale(storedLocale);
    setLocaleState(config.code);
  }, []);

  const setLocale = useCallback((nextLocale: string) => {
    const config = getLocaleConfig(nextLocale);
    const root = document.documentElement;

    if (config.code === locale) {
      return;
    }

    root.classList.remove(
      "meet-locale-changing",
      "meet-locale-to-ltr",
      "meet-locale-to-rtl"
    );
    root.classList.add(
      "meet-locale-changing",
      `meet-locale-to-${config.direction}`
    );

    window.setTimeout(() => {
      root.classList.remove(
        "meet-locale-changing",
        "meet-locale-to-ltr",
        "meet-locale-to-rtl"
      );
    }, 340);

    applyDocumentLocale(config.code);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, config.code);
    setLocaleState(config.code);
  }, [locale]);

  const toggleLocale = useCallback(() => {
    setLocale(getNextLocale(locale).code);
  }, [locale, setLocale]);

  const value = useMemo(() => {
    const currentLocale = getLocaleConfig(locale);
    const messages = getMessages(currentLocale.code);

    return {
      currentLocale,
      direction: currentLocale.direction,
      isRtl: currentLocale.direction === "rtl",
      setLocale,
      supportedLocales: SUPPORTED_LOCALES,
      t: (key: MessageKey, values?: Record<string, string | number>) =>
        formatMessage(messages[key], values),
      toggleLocale
    };
  }, [locale, setLocale, toggleLocale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    return fallbackLocaleContext;
  }

  return context;
}
