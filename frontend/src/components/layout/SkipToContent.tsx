"use client";

import { useLocale } from "@/providers/LocaleProvider";

export function SkipToContent() {
  const { t } = useLocale();

  return (
    <a
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      href="#main-content"
    >
      {t("common.skipToContent")}
    </a>
  );
}
