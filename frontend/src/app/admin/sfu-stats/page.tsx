"use client";

import { SFUStatsPanel } from "@/features/admin/components/SFUStatsPanel";
import { useAdminSfuStats } from "@/features/admin/hooks/useAdminRooms";

export default function AdminSFUStatsPage() {
  const stats = useAdminSfuStats();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">
          SFU stats
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Monitor active relay sessions and throughput.
        </p>
      </div>
      {stats.error ? (
        <p className="text-sm text-danger">Could not load SFU stats.</p>
      ) : null}
      <SFUStatsPanel stats={stats.data} />
    </section>
  );
}
