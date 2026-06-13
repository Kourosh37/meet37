export type LocaleDirection = "ltr" | "rtl";

export interface LocaleConfig {
  code: string;
  direction: LocaleDirection;
  htmlLang: string;
  label: string;
  nativeName: string;
}

export const LOCALE_STORAGE_KEY = "meet37.locale";
export const DEFAULT_LOCALE = "en";

export const SUPPORTED_LOCALES = [
  {
    code: "en",
    direction: "ltr",
    htmlLang: "en",
    label: "EN",
    nativeName: "English"
  },
  {
    code: "fa",
    direction: "rtl",
    htmlLang: "fa",
    label: "FA",
    nativeName: "فارسی"
  },
  {
    code: "ar",
    direction: "rtl",
    htmlLang: "ar",
    label: "AR",
    nativeName: "العربية"
  },
  {
    code: "fr",
    direction: "ltr",
    htmlLang: "fr",
    label: "FR",
    nativeName: "Français"
  },
  {
    code: "es",
    direction: "ltr",
    htmlLang: "es",
    label: "ES",
    nativeName: "Español"
  },
  {
    code: "pt",
    direction: "ltr",
    htmlLang: "pt",
    label: "PT",
    nativeName: "Português"
  },
  {
    code: "ru",
    direction: "ltr",
    htmlLang: "ru",
    label: "RU",
    nativeName: "Русский"
  },
  {
    code: "zh",
    direction: "ltr",
    htmlLang: "zh",
    label: "ZH",
    nativeName: "中文"
  },
  {
    code: "ja",
    direction: "ltr",
    htmlLang: "ja",
    label: "JA",
    nativeName: "日本語"
  },
  {
    code: "ko",
    direction: "ltr",
    htmlLang: "ko",
    label: "KO",
    nativeName: "한국어"
  },
  {
    code: "de",
    direction: "ltr",
    htmlLang: "de",
    label: "DE",
    nativeName: "Deutsch"
  },
  {
    code: "it",
    direction: "ltr",
    htmlLang: "it",
    label: "IT",
    nativeName: "Italiano"
  },
  {
    code: "hi",
    direction: "ltr",
    htmlLang: "hi",
    label: "HI",
    nativeName: "हिन्दी"
  },
  {
    code: "tr",
    direction: "ltr",
    htmlLang: "tr",
    label: "TR",
    nativeName: "Türkçe"
  },
  {
    code: "ur",
    direction: "rtl",
    htmlLang: "ur-PK",
    label: "UR",
    nativeName: "اردو"
  },
  {
    code: "he",
    direction: "rtl",
    htmlLang: "he",
    label: "HE",
    nativeName: "עברית"
  }
] as const satisfies readonly LocaleConfig[];

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]["code"];

export function getLocaleConfig(locale?: string | null): LocaleConfig {
  return (
    SUPPORTED_LOCALES.find((item) => item.code === locale) ??
    SUPPORTED_LOCALES[0]
  );
}

export function getNextLocale(locale?: string | null) {
  const currentIndex = SUPPORTED_LOCALES.findIndex(
    (item) => item.code === locale
  );
  const nextIndex =
    currentIndex === -1 ? 0 : (currentIndex + 1) % SUPPORTED_LOCALES.length;

  return SUPPORTED_LOCALES[nextIndex];
}

export function applyDocumentLocale(locale?: string | null) {
  if (typeof document === "undefined") {
    return getLocaleConfig(locale);
  }

  const config = getLocaleConfig(locale);
  const root = document.documentElement;

  root.lang = config.htmlLang;
  root.dir = config.direction;
  root.dataset.locale = config.code;
  root.dataset.direction = config.direction;
  root.classList.toggle("is-rtl", config.direction === "rtl");
  root.classList.toggle("is-ltr", config.direction === "ltr");

  return config;
}

const localeHydrationMap = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [
    locale.code,
    {
      direction: locale.direction,
      htmlLang: locale.htmlLang
    }
  ])
);

export const localeHydrationScript = `(function(){try{var key="${LOCALE_STORAGE_KEY}";var locales=${JSON.stringify(localeHydrationMap)};var locale=localStorage.getItem(key)||"${DEFAULT_LOCALE}";var config=locales[locale]||locales["${DEFAULT_LOCALE}"];locale=locales[locale]?locale:"${DEFAULT_LOCALE}";var rtl=config.direction==="rtl";var root=document.documentElement;root.lang=config.htmlLang;root.dir=config.direction;root.dataset.locale=locale;root.dataset.direction=config.direction;root.classList.toggle("is-rtl",rtl);root.classList.toggle("is-ltr",!rtl);}catch(error){}})();`;
