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
