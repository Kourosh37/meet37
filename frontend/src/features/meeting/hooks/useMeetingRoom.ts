/*
Frontend architecture note

File: src\features\meeting\hooks\useMeetingRoom.ts
Layer: Meeting Runtime

Responsibility:
- Top-level meeting orchestrator hook that coordinates prejoin data, WebSocket join, local media, peer connections, moderation, chat, files, stats, and cleanup.

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

import { useCallback } from "react";
import { useSignalingMessages } from "@/features/meeting/hooks/useSignalingMessages";
import { useWebSocket } from "@/features/meeting/hooks/useWebSocket";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import { getHostToken } from "@/lib/storage/tokenStorage";

interface JoinMeetingInput {
  displayName: string;
  password?: string;
}

export function useMeetingRoom(roomId: string) {
  const meeting = useMeetingStore();
  const websocket = useWebSocket();
  useSignalingMessages();

  const joinMeeting = useCallback(
    ({ displayName, password }: JoinMeetingInput) => {
      const normalizedDisplayName = displayName.trim();

      if (!normalizedDisplayName) {
        meeting.setError("Display name is required");
        return { joinedAsHost: false };
      }

      const hostToken = getHostToken(roomId);

      meeting.beginJoin(roomId);
      websocket.connect();
      websocket.send({
        payload: {
          display_name: normalizedDisplayName,
          host_token: hostToken ?? undefined,
          password: password?.trim() || undefined,
          room_id: roomId
        },
        type: "join"
      });

      return { joinedAsHost: Boolean(hostToken) };
    },
    [meeting, roomId, websocket]
  );

  const cancelJoin = useCallback(() => {
    websocket.close();
    meeting.reset();
  }, [meeting, websocket]);

  const leaveMeeting = useCallback(() => {
    websocket.send({ type: "leave" });
    websocket.close();
    meeting.reset();
  }, [meeting, websocket]);

  return {
    cancelJoin,
    joinMeeting,
    leaveMeeting,
    meeting,
    websocket
  };
}
