import {
  applyDocumentLocale,
  DEFAULT_LOCALE,
  getLocaleConfig,
  getNextLocale,
  SUPPORTED_LOCALES
} from "@/lib/i18n/config";
import { describe, expect, it } from "vitest";

describe("i18n config", () => {
  it("falls back to the default locale", () => {
    expect(getLocaleConfig("missing").code).toBe(DEFAULT_LOCALE);
  });

  it("cycles through supported locale directions", () => {
    expect(getNextLocale("en").direction).toBe("rtl");
    expect(getNextLocale("fa").direction).toBe("rtl");
  });

  it("applies locale metadata to the document root", () => {
    const config = applyDocumentLocale("fa");

    expect(config.direction).toBe("rtl");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("fa");
    expect(document.documentElement.dataset.locale).toBe("fa");
    expect(document.documentElement.classList.contains("is-rtl")).toBe(true);

    applyDocumentLocale("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.classList.contains("is-ltr")).toBe(true);
  });

  it("registers the configured meeting languages", () => {
    expect(SUPPORTED_LOCALES).toHaveLength(16);
    expect(SUPPORTED_LOCALES.map((locale) => locale.code)).toEqual([
      "en",
      "fa",
      "ar",
      "fr",
      "es",
      "pt",
      "ru",
      "zh",
      "ja",
      "ko",
      "de",
      "it",
      "hi",
      "tr",
      "ur",
      "he"
    ]);
    expect(getLocaleConfig("fa")).toMatchObject({
      direction: "rtl",
      flagCountries: ["IR", "AF", "TJ"],
      nativeName: "فارسی"
    });
    expect(
      SUPPORTED_LOCALES.every((locale) => locale.flagCountries.length > 0)
    ).toBe(true);
    expect(
      SUPPORTED_LOCALES.filter((locale) => locale.direction === "rtl").map(
        (locale) => locale.code
      )
    ).toEqual(["fa", "ar", "ur", "he"]);
    expect(getLocaleConfig("ur")).toMatchObject({
      direction: "rtl",
      htmlLang: "ur-PK",
      label: "UR",
      nativeName: "اردو"
    });
    expect(getLocaleConfig("he")).toMatchObject({
      direction: "rtl",
      flagCountries: ["IL"],
      htmlLang: "he",
      label: "HE",
      nativeName: "עברית"
    });
  });
});
