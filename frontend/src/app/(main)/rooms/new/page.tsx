"use client";

import Link from "next/link";
import { RoomCreationForm } from "@/features/rooms/components/RoomCreationForm";
import { useLocale } from "@/providers/LocaleProvider";
import { Home } from "lucide-react";

export default function CreateRoomPage() {
  const { t } = useLocale();

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          className="mb-5 inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-surface-foreground shadow-sm transition hover:bg-muted"
          href="/"
        >
          <Home className="size-4" />
          {t("common.backHome")}
        </Link>
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
      </div>
    </section>
  );
}
