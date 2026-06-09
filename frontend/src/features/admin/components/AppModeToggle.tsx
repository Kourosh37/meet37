"use client";

import { useLocale } from "@/providers/LocaleProvider";
import type { AppMode } from "@/types/api";

interface AppModeToggleProps {
  appMode?: AppMode;
  disabled?: boolean;
  onChange: (mode: AppMode) => void;
}

export function AppModeToggle({
  appMode,
  disabled = false,
  onChange
}: AppModeToggleProps) {
  const { t } = useLocale();

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-surface-foreground">
        {t("admin.appMode")}
      </h2>
      <div className="mt-4 inline-grid grid-cols-2 rounded-md border border-border bg-background p-1">
        {(["public", "private"] as const).map((mode) => (
          <button
            className={
              appMode === mode
                ? "rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                : "rounded-sm px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
            }
            disabled={disabled}
            key={mode}
            onClick={() => onChange(mode)}
            type="button"
          >
            {mode === "public" ? t("admin.public") : t("admin.private")}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {t("admin.appModeDescription")}
      </p>
    </div>
  );
}
