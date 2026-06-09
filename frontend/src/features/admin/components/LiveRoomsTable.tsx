"use client";

import type { LiveRoomStats, Room } from "@/types/api";
import { useLocale } from "@/providers/LocaleProvider";

interface LiveRoomsTableProps {
  rows: Array<{
    room: Room;
    stats?: LiveRoomStats;
  }>;
}

export function LiveRoomsTable({ rows }: LiveRoomsTableProps) {
  const { t } = useLocale();

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground shadow-sm">
        {t("admin.noLiveRooms")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">{t("admin.rooms")}</th>
            <th className="px-4 py-3">{t("admin.peers")}</th>
            <th className="px-4 py-3">{t("admin.pending")}</th>
            <th className="px-4 py-3">{t("admin.mode")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ room, stats }) => (
            <tr className="border-t border-border" key={room.id}>
              <td className="px-4 py-3">
                <p className="font-medium text-surface-foreground">
                  {room.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{room.id}</p>
              </td>
              <td className="px-4 py-3 text-surface-foreground">
                {stats?.peer_count ?? 0}
              </td>
              <td className="px-4 py-3 text-surface-foreground">
                {stats?.pending_count ?? 0}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {t("admin.sfu")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
