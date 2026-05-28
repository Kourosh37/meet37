"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import type { MediaKind } from "@/features/meeting/types/signaling";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

export function useModeration() {
  const isHost = useMeetingStore((state) => state.isHost);
  const pendingPeers = useMeetingStore((state) => state.pendingPeers);
  const removePendingPeer = useMeetingStore((state) => state.removePendingPeer);

  const approvePeer = useCallback(
    (peerId: string) => {
      if (!isHost) {
        return;
      }

      webSocketManager.send({
        payload: { peer_id: peerId },
        type: "approve-peer"
      });
      removePendingPeer(peerId);
    },
    [isHost, removePendingPeer]
  );

  const rejectPeer = useCallback(
    (peerId: string, reason = "The host declined your request.") => {
      if (!isHost) {
        return;
      }

      webSocketManager.send({
        payload: { peer_id: peerId, reason },
        type: "reject-peer"
      });
      removePendingPeer(peerId);
    },
    [isHost, removePendingPeer]
  );

  const mutePeer = useCallback(
    (peerId: string, kind: MediaKind = "audio") => {
      if (!isHost) {
        return;
      }

      webSocketManager.send({
        payload: { kind, peer_id: peerId },
        type: "mute-peer"
      });
      toast.info("Mute request sent");
    },
    [isHost]
  );

  const kickPeer = useCallback(
    (peerId: string, reason = "Removed by the host.") => {
      if (!isHost) {
        return;
      }

      webSocketManager.send({
        payload: { peer_id: peerId, reason },
        type: "kick-peer"
      });
    },
    [isHost]
  );

  return {
    approvePeer,
    canModerate: isHost,
    kickPeer,
    mutePeer,
    pendingPeers,
    rejectPeer
  };
}
