"use client";

import { InlineError } from "@/components/feedback/InlineError";
import { SFUStatsPanel } from "@/features/admin/components/SFUStatsPanel";
import { useAdminSfuStats } from "@/features/admin/hooks/useAdminRooms";
import { useLocale } from "@/providers/LocaleProvider";

export default function AdminSFUStatsPage() {
  const stats = useAdminSfuStats();
  const { t } = useLocale();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">
          {t("admin.sfuStats")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("admin.sfuStatsDescription")}
        </p>
      </div>
      <InlineError
        message={stats.error ? t("error.couldNotLoadSfuStats") : null}
      />
      <SFUStatsPanel stats={stats.data} />
    </section>
  );
}
