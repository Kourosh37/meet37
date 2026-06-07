"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import type { PendingPeer } from "@/features/meeting/types/peer";

interface AdmissionModalProps {
  onApprove: (peerId: string) => void;
  onApproveAll?: () => void;
  onReject: (peerId: string) => void;
  pendingPeers: PendingPeer[];
}

export function AdmissionModal({
  onApprove,
  onApproveAll,
  onReject,
  pendingPeers
}: AdmissionModalProps) {
  const [approving, setApproving] = useState<"one" | "all" | null>(null);

  if (pendingPeers.length === 0) {
    return null;
  }

  const firstPeer = pendingPeers[0];

  return (
    <div className="fixed bottom-24 right-4 z-30 w-[min(360px,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <UserPlus className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-surface-foreground">
            {firstPeer.displayName} wants to join
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {pendingPeers.length > 1
              ? `${pendingPeers.length - 1} more waiting in the queue.`
              : "Review this admission request."}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              disabled={approving !== null}
              onClick={() => {
                setApproving("one");
                onApprove(firstPeer.id);
              }}
              type="button"
            >
              {approving === "one" ? (
                <LoadingSpinner label="Admitting participant" size="sm" />
              ) : null}
              Admit
            </button>
            {pendingPeers.length > 1 ? (
              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
                disabled={approving !== null}
                onClick={() => {
                  setApproving("all");
                  onApproveAll?.();
                }}
                type="button"
              >
                {approving === "all" ? (
                  <LoadingSpinner
                    label="Admitting all participants"
                    size="sm"
                  />
                ) : null}
                Admit all
              </button>
            ) : null}
            <button
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
              onClick={() => onReject(firstPeer.id)}
              type="button"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
