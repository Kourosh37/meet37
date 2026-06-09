"use client";

import { InlineError } from "@/components/feedback/InlineError";
import { AppModeToggle } from "@/features/admin/components/AppModeToggle";
import { useAdminSettings } from "@/features/admin/hooks/useAdminSettings";
import { useLocale } from "@/providers/LocaleProvider";

export default function AdminSettingsPage() {
  const settings = useAdminSettings();
  const { t } = useLocale();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">
          {t("admin.settings")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("admin.settingsDescription")}
        </p>
      </div>
      <InlineError
        message={settings.error ? t("error.couldNotLoadSettings") : null}
      />
      <AppModeToggle
        appMode={settings.appMode}
        disabled={settings.isLoading || settings.isUpdating}
        onChange={settings.setAppMode}
      />
    </section>
  );
}
