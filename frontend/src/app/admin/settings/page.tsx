"use client";

import { InlineError } from "@/components/feedback/InlineError";
import { AppModeToggle } from "@/features/admin/components/AppModeToggle";
import { useAdminSettings } from "@/features/admin/hooks/useAdminSettings";

export default function AdminSettingsPage() {
  const settings = useAdminSettings();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">
          Settings
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Control public and private room creation policy.
        </p>
      </div>
      <InlineError
        message={settings.error ? "Could not load settings." : null}
      />
      <AppModeToggle
        appMode={settings.appMode}
        disabled={settings.isLoading || settings.isUpdating}
        onChange={settings.setAppMode}
      />
    </section>
  );
}
