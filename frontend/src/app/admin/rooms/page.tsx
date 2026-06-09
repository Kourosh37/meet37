"use client";

import { InlineError } from "@/components/feedback/InlineError";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { LiveRoomsTable } from "@/features/admin/components/LiveRoomsTable";
import { useAdminRooms } from "@/features/admin/hooks/useAdminRooms";
import { useLocale } from "@/providers/LocaleProvider";

export default function AdminRoomsPage() {
  const rooms = useAdminRooms();
  const { t } = useLocale();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">
          {t("admin.liveRooms")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("admin.liveRoomsDescription")}
        </p>
      </div>
      <InlineError
        message={rooms.error ? t("error.couldNotLoadRoomStats") : null}
      />
      {rooms.isLoading ? (
        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
          <LoadingSpinner
            className="text-primary"
            label={t("admin.loadingLiveRooms")}
          />
          {t("admin.loadingLiveRooms")}
        </div>
      ) : (
        <LiveRoomsTable rows={rooms.rooms} />
      )}
    </section>
  );
}
