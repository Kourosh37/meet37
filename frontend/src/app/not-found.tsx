"use client";

import Link from "next/link";
import { useLocale } from "@/providers/LocaleProvider";

export default function NotFoundPage() {
  const { t } = useLocale();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-surface-foreground">
          {t("error.pageNotFound")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("error.routeNotFound")}
        </p>
        <Link
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          href="/"
        >
          {t("meeting.goHome")}
        </Link>
      </section>
    </main>
  );
}
