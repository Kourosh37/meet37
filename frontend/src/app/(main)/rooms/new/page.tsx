"use client";

import Link from "next/link";
import { RoomCreationForm } from "@/features/rooms/components/RoomCreationForm";
import { useLocale } from "@/providers/LocaleProvider";

export default function CreateRoomPage() {
  const { t } = useLocale();

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">{t("room.roomSetup")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">
          {t("room.createRoomTitle")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("room.createRoomDescription")}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <RoomCreationForm />
        <div className="mt-6">
          <Link
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
            href="/"
          >
            {t("common.backHome")}
          </Link>
        </div>
      </div>
    </section>
  );
}
