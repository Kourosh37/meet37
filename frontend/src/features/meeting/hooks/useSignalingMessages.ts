/*
Frontend architecture note

File: src\features\meeting\hooks\useSignalingMessages.ts
Layer: Meeting Runtime

Responsibility:
- Frontend file for the Meeting Runtime layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: WebSocket signaling endpoint described in backend/docs/WEBSOCKET.md plus room metadata from GET /api/rooms/{id}. The join payload must include display_name and may include password and host_token.

State model to plan: idle, prejoining, waiting-approval, joining, in-call, reconnecting, sfu-active, kicked, rejected, room-closed, media-error, and left.

UX and edge cases to plan:
- Display clear loading and empty states instead of rendering nothing once implementation starts.
- Normalize backend errors into user-safe messages while preserving technical details for logger.ts.
- Keep room links shareable; never require global login just to open an existing meeting link.
- In private app mode, require login only for room creation, not for joining a shared room link.
- Every meeting participant must provide a non-empty display name before joining.

Security and privacy notes:
- Never expose refresh tokens to arbitrary components; use the storage/auth layer only.
- Treat host_token as room-scoped moderation authority and avoid leaking it into URLs or logs.
- Do not persist raw media streams, SDP blobs, ICE candidates, or file bytes unless a later backend feature explicitly requires it.

Future tests: WebSocket join flow, approval room flow, host approve/reject, kick/mute messages, P2P signaling, SFU switch handling, chat/file events, and cleanup on leave.

*/

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
