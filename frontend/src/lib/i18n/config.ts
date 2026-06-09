export type LocaleDirection = "ltr" | "rtl";

export interface LocaleConfig {
  code: string;
  direction: LocaleDirection;
  flagCountries: readonly string[];
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
    flagCountries: [
      "US",
      "GB",
      "CA",
      "AU",
      "NZ",
      "IE",
      "ZA",
      "NG",
      "GH",
      "KE",
      "UG",
      "TZ",
      "ZM",
      "ZW",
      "MW",
      "RW",
      "SL",
      "LR",
      "GM",
      "BW",
      "LS",
      "SZ",
      "NA",
      "SS",
      "JM",
      "TT",
      "BS",
      "BB",
      "BZ",
      "GY",
      "AG",
      "DM",
      "GD",
      "KN",
      "LC",
      "VC",
      "IN",
      "PK",
      "PH",
      "SG",
      "FJ",
      "PG",
      "SB",
      "VU",
      "WS",
      "KI",
      "TO",
      "TV",
      "NR",
      "PW",
      "MH",
      "FM",
      "MT",
      "MU",
      "SC",
      "CM",
    ],
    htmlLang: "en",
    label: "EN",
    nativeName: "English"
  },
  {
    code: "fa",
    direction: "rtl",
    flagCountries: ["IR", "AF", "TJ"],
    htmlLang: "fa",
    label: "FA",
    nativeName: "فارسی"
  },
  {
    code: "ar",
    direction: "rtl",
    flagCountries: [
      "DZ",
      "BH",
      "KM",
      "TD",
      "DJ",
      "EG",
      "IQ",
      "JO",
      "KW",
      "LB",
      "LY",
      "MR",
      "MA",
      "OM",
      "PS",
      "QA",
      "SA",
      "SO",
      "SD",
      "SY",
      "TN",
      "AE",
      "YE",
    ],
    htmlLang: "ar",
    label: "AR",
    nativeName: "العربية"
  },
  {
    code: "fr",
    direction: "ltr",
    flagCountries: [
      "FR",
      "BE",
      "CH",
      "LU",
      "MC",
      "CA",
      "HT",
      "BJ",
      "BF",
      "BI",
      "CM",
      "CF",
      "TD",
      "KM",
      "CG",
      "CD",
      "CI",
      "DJ",
      "GQ",
      "GA",
      "GN",
      "MG",
      "ML",
      "NE",
      "RW",
      "SN",
      "SC",
      "TG",
      "VU",
    ],
    htmlLang: "fr",
    label: "FR",
    nativeName: "Français"
  },
  {
    code: "es",
    direction: "ltr",
    flagCountries: [
      "ES",
      "MX",
      "GT",
      "SV",
      "HN",
      "NI",
      "CR",
      "PA",
      "CU",
      "DO",
      "PR",
      "CO",
      "VE",
      "EC",
      "PE",
      "BO",
      "CL",
      "AR",
      "UY",
      "PY",
      "GQ",
    ],
    htmlLang: "es",
    label: "ES",
    nativeName: "Español"
  },
  {
    code: "pt",
    direction: "ltr",
    flagCountries: [
      "PT",
      "BR",
      "AO",
      "MZ",
      "CV",
      "GW",
      "ST",
      "TL",
      "GQ",
    ],
    htmlLang: "pt",
    label: "PT",
    nativeName: "Português"
  },
  {
    code: "ru",
    direction: "ltr",
    flagCountries: ["RU", "BY", "KZ", "KG"],
    htmlLang: "ru",
    label: "RU",
    nativeName: "Русский"
  },
  {
    code: "zh",
    direction: "ltr",
    flagCountries: ["CN", "TW", "SG", "HK", "MO"],
    htmlLang: "zh",
    label: "ZH",
    nativeName: "中文"
  },
  {
    code: "ja",
    direction: "ltr",
    flagCountries: ["JP"],
    htmlLang: "ja",
    label: "JA",
    nativeName: "日本語"
  },
  {
    code: "ko",
    direction: "ltr",
    flagCountries: ["KR", "KP"],
    htmlLang: "ko",
    label: "KO",
    nativeName: "한국어"
  },
  {
    code: "de",
    direction: "ltr",
    flagCountries: ["DE", "AT", "CH", "LI", "LU", "BE"],
    htmlLang: "de",
    label: "DE",
    nativeName: "Deutsch"
  },
  {
    code: "it",
    direction: "ltr",
    flagCountries: ["IT", "CH", "SM", "VA"],
    htmlLang: "it",
    label: "IT",
    nativeName: "Italiano"
  },
  {
    code: "hi",
    direction: "ltr",
    flagCountries: ["IN", "FJ"],
    htmlLang: "hi",
    label: "HI",
    nativeName: "हिन्दी"
  },
  {
    code: "tr",
    direction: "ltr",
    flagCountries: ["TR", "CY"],
    htmlLang: "tr",
    label: "TR",
    nativeName: "Türkçe"
  },
  {
    code: "ur",
    direction: "rtl",
    flagCountries: ["PK", "IN"],
    htmlLang: "ur-PK",
    label: "UR",
    nativeName: "اردو"
  },
  {
    code: "he",
    direction: "rtl",
    flagCountries: ["IL"],
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
