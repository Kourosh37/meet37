"use client";

import { useEffect } from "react";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

export function useSignalingMessages() {
  const store = useMeetingStore();

  useEffect(() => {
    const unsubscribers = [
      webSocketManager.subscribe("joined", (message) =>
        store.joined(message.payload)
      ),
      webSocketManager.subscribe("waiting-approval", (message) =>
        store.waitingApproval(message.payload.your_id)
      ),
      webSocketManager.subscribe("join-request", (message) =>
        store.addJoinRequest(message.payload)
      ),
      webSocketManager.subscribe("join-rejected", (message) => {
        store.setError(
          message.payload?.reason ?? "Your request to join was declined."
        );
        store.setPhase("rejected");
      }),
      webSocketManager.subscribe("peer-joined", (message) =>
        store.addPeer(message.payload)
      ),
      webSocketManager.subscribe("peer-left", (message) =>
        store.removePeer(message.payload)
      ),
      webSocketManager.subscribe("peer-mode-changed", (message) =>
        store.setPeerMode(message.payload.peer_id, message.payload.mode)
      ),
      webSocketManager.subscribe("media-state", (message) => {
        if (!message.from) {
          return;
        }

        store.setPeerMedia(message.from, {
          audioEnabled: message.payload.audio_enabled,
          audioStatus:
            message.payload.audio_status ??
            (message.payload.audio_enabled ? "ready" : "off"),
          screenSharing: message.payload.screen_sharing ?? false,
          screenShareStatus:
            message.payload.screen_share_status ??
            (message.payload.screen_sharing ? "starting" : "off"),
          videoStatus:
            message.payload.video_status ??
            (message.payload.video_enabled ? "ready" : "off"),
          videoEnabled: message.payload.video_enabled
        });
      }),
      webSocketManager.subscribe("room-closed", () =>
        store.setPhase("room-closed")
      ),
      webSocketManager.subscribe("kicked", (message) => {
        store.setError(
          message.payload?.reason ?? "You were removed from the meeting."
        );
        store.setPhase("kicked");
      }),
      webSocketManager.subscribe("error", (message) => {
        const currentState = useMeetingStore.getState();

        if (
          currentState.phase === "joining" ||
          currentState.phase === "waiting-approval"
        ) {
          webSocketManager.close();
          currentState.failJoin(message.payload.message);
          return;
        }

        currentState.setError(message.payload.message);
      })
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [store]);
}
