"use client";

import { Activity, Gauge, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/providers/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const adminLinks = [
  { href: "/admin", labelKey: "admin.dashboard", icon: Gauge },
  { href: "/admin/users", labelKey: "admin.users", icon: Users },
  { href: "/admin/rooms", labelKey: "admin.rooms", icon: Activity },
  { href: "/admin/settings", labelKey: "admin.settings", icon: Settings }
] satisfies Array<{ href: string; labelKey: MessageKey; icon: typeof Gauge }>;

export function Sidebar() {
  const { t } = useLocale();

  return (
    <aside className="border-b border-border bg-surface md:min-h-screen md:w-64 md:border-b-0 md:border-e">
      <div className="flex h-16 items-center border-b border-border px-4">
        <Link
          className="inline-flex items-center gap-2 font-semibold text-surface-foreground"
          href="/"
        >
          {t("admin.admin")}
        </Link>
      </div>
      <nav
        aria-label={t("admin.navigation")}
        className="flex gap-2 overflow-x-auto p-3 md:flex-col"
      >
        {adminLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              href={item.href}
              key={item.href}
            >
              <Icon className="size-4 shrink-0" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
