"use client";

import { ParticipantItem } from "@/features/meeting/components/ParticipantItem";
import type { MeetingPeer, PendingPeer } from "@/features/meeting/types/peer";

interface ParticipantsPanelProps {
  canModerate: boolean;
  localPeer: MeetingPeer;
  onApprove: (peerId: string) => void;
  onKick: (peerId: string) => void;
  onMute: (peerId: string) => void;
  onReject: (peerId: string) => void;
  peers: Record<string, MeetingPeer>;
  pendingPeers: PendingPeer[];
}

export function ParticipantsPanel({
  canModerate,
  localPeer,
  onApprove,
  onKick,
  onMute,
  onReject,
  peers,
  pendingPeers
}: ParticipantsPanelProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-surface-foreground">
          Participants
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {Object.keys(peers).length + 1} in call
        </p>
      </div>

      {canModerate && pendingPeers.length > 0 ? (
        <section className="mt-4 rounded-md border border-primary/30 bg-primary/10 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
            Waiting
          </h3>
          <div className="mt-3 grid gap-2">
            {pendingPeers.map((peer) => (
              <div key={peer.id} className="rounded-md bg-surface p-2">
                <p className="truncate text-sm font-medium text-surface-foreground">
                  {peer.displayName}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                    onClick={() => onApprove(peer.id)}
                    type="button"
                  >
                    Admit
                  </button>
                  <button
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-foreground"
                    onClick={() => onReject(peer.id)}
                    type="button"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ul className="mt-4 grid min-h-0 gap-2 overflow-y-auto">
        <ParticipantItem canModerate={canModerate} isLocal peer={localPeer} />
        {Object.values(peers).map((peer) => (
          <ParticipantItem
            canModerate={canModerate}
            key={peer.id}
            onKick={onKick}
            onMute={onMute}
            peer={peer}
          />
        ))}
      </ul>
    </aside>
  );
}
