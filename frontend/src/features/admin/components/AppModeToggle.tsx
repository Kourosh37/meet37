"use client";

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
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-surface-foreground">
        Application mode
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
            {mode === "public" ? "Public" : "Private"}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Public mode allows anonymous room creation. Private mode requires an
        admin-created user account for room creation.
      </p>
    </div>
  );
}
