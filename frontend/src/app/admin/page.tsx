"use client";

import Link from "next/link";
import { useLocale } from "@/providers/LocaleProvider";

export default function AdminDashboardPage() {
  const { t } = useLocale();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">{t("common.admin")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">
          {t("admin.dashboard")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("admin.dashboardDescription")}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [t("admin.appMode"), t("admin.appModeSummary")],
          [t("admin.liveRooms"), t("admin.roomStats")],
          [t("admin.sfuStats"), t("admin.relayMetrics")]
        ].map(([title, detail]) => (
          <div
            className="rounded-lg border border-border bg-surface p-5 shadow-sm"
            key={title}
          >
            <h2 className="text-sm font-semibold text-surface-foreground">
              {title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
      <Link
        className="text-sm font-medium text-primary hover:text-primary/80"
        href="/admin/users"
      >
        {t("admin.manageUsers")}
      </Link>
    </section>
  );
}
