"use client";

import type { AdminSfuStatsResponse } from "@/types/api";
import { formatBytes } from "@/lib/utils/formatters";

interface SFUStatsPanelProps {
  stats?: AdminSfuStatsResponse;
}

export function SFUStatsPanel({ stats }: SFUStatsPanelProps) {
  const sessions = Object.entries(stats?.sessions ?? {});
  const totals = sessions.reduce(
    (acc, [, session]) => ({
      bytes: acc.bytes + session.bytes_relayed,
      peers: acc.peers + session.peer_count,
      tracks: acc.tracks + session.track_count
    }),
    { bytes: 0, peers: 0, tracks: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Sessions", stats?.session_count ?? 0],
          ["Peers", totals.peers],
          ["Relayed bytes", formatBytes(totals.bytes)]
        ].map(([label, value]) => (
          <div
            className="rounded-lg border border-border bg-surface p-5 shadow-sm"
            key={label}
          >
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-surface-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Peers</th>
              <th className="px-4 py-3">Tracks</th>
              <th className="px-4 py-3">Bytes</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-muted-foreground" colSpan={4}>
                  No active SFU sessions.
                </td>
              </tr>
            ) : (
              sessions.map(([sessionId, session]) => (
                <tr className="border-t border-border" key={sessionId}>
                  <td className="px-4 py-3 font-medium text-surface-foreground">
                    {sessionId}
                  </td>
                  <td className="px-4 py-3">{session.peer_count}</td>
                  <td className="px-4 py-3">{session.track_count}</td>
                  <td className="px-4 py-3">
                    {formatBytes(session.bytes_relayed)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
