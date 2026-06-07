"use client";

import { InlineError } from "@/components/feedback/InlineError";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { LiveRoomsTable } from "@/features/admin/components/LiveRoomsTable";
import { useAdminRooms } from "@/features/admin/hooks/useAdminRooms";

export default function AdminRoomsPage() {
  const rooms = useAdminRooms();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">
          Live rooms
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Monitor participant counts, pending approvals, and relay mode.
        </p>
      </div>
      <InlineError
        message={rooms.error ? "Could not load room stats." : null}
      />
      {rooms.isLoading ? (
        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
          <LoadingSpinner className="text-primary" label="Loading live rooms" />
          Loading live rooms
        </div>
      ) : (
        <LiveRoomsTable rows={rooms.rooms} />
      )}
    </section>
  );
}
