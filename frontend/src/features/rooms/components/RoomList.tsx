"use client";

import { InlineError } from "@/components/feedback/InlineError";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { useRooms } from "@/features/rooms/hooks/useRoomMeta";
import { formatUnixSeconds } from "@/lib/utils/formatters";
import { useLocale } from "@/providers/LocaleProvider";
import { Lock, Users, Video } from "lucide-react";
import Link from "next/link";

export function RoomList() {
  const { data: rooms, error, isLoading } = useRooms();
  const { t } = useLocale();

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center gap-3 py-10 text-sm font-medium text-muted-foreground"
        aria-label={t("room.loadingRooms")}
      >
        <LoadingSpinner className="text-primary" label={t("room.loadingRooms")} />
        {t("room.loadingRooms")}
      </div>
    );
  }

  if (error) {
    return <InlineError className="p-4" message={t("error.couldNotLoadRooms")} />;
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="py-10 text-center">
        <Video className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-surface-foreground">
          {t("room.noActiveRooms")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("room.createRoomFirstMeeting")}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {rooms.map((room) => (
        <Link
          className="block py-4 transition hover:bg-muted/60"
          href={`/meet/${room.id}`}
          key={room.id}
        >
          <div className="flex items-start justify-between gap-4 px-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-surface-foreground">
                {room.name}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("room.createdAt", {
                  date: formatUnixSeconds(room.created_at)
                })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {room.has_password ? (
                <Lock className="size-4" aria-label={t("room.passwordProtected")} />
              ) : null}
              <Users className="size-4" />
              {room.max_peers}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
