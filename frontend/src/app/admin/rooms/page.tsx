"use client";

import { InlineError } from "@/components/feedback/InlineError";
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
        <p className="text-sm text-muted-foreground">Loading live rooms...</p>
      ) : (
        <LiveRoomsTable rows={rooms.rooms} />
      )}
    </section>
  );
}
