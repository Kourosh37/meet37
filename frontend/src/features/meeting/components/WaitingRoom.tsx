"use client";

import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { useLocale } from "@/providers/LocaleProvider";

interface WaitingRoomProps {
  onCancel: () => void;
  roomName?: string;
}

export function WaitingRoom({ onCancel, roomName }: WaitingRoomProps) {
  const { t } = useLocale();

  return (
    <section className="mx-auto max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("meeting.waitingRoom")}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-normal text-surface-foreground">
        {t("meeting.waitingApproval")}
      </h1>
      <LoadingSpinner
        className="mt-5 text-primary"
        label={t("meeting.waitingApproval")}
        size="lg"
      />
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {t("meeting.waitingRoomBody", {
          roomName: roomName ?? t("meeting.defaultRoomName")
        })}
      </p>
      <button
        className="mt-6 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
        onClick={onCancel}
        type="button"
      >
        {t("common.cancel")}
      </button>
    </section>
  );
}
