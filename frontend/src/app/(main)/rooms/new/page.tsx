"use client";

import { RoomCreationForm } from "@/features/rooms/components/RoomCreationForm";
import { useLocale } from "@/providers/LocaleProvider";

export default function CreateRoomPage() {
  const { t } = useLocale();

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
          {t("room.roomSetup")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("room.createRoomDescription")}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <RoomCreationForm />
      </div>
    </section>
  );
}
