"use client";

import Link from "next/link";
import { useLocale } from "@/providers/LocaleProvider";

export default function MeetingError({
  reset
}: {
  error: Error;
  reset: () => void;
}) {
  const { t } = useLocale();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-normal text-surface-foreground">
          {t("meeting.roomUnavailable")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("error.meetingUnavailable")}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
            onClick={reset}
            type="button"
          >
            {t("common.retry")}
          </button>
          <Link
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            href="/"
          >
            {t("meeting.goHome")}
          </Link>
        </div>
      </section>
    </main>
  );
}
