"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { useSignalingMessages } from "@/features/meeting/hooks/useSignalingMessages";
import { useWebSocket } from "@/features/meeting/hooks/useWebSocket";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import { getHostToken } from "@/lib/storage/tokenStorage";

interface JoinMeetingInput {
  displayName: string;
  password?: string;
}

export const MEETING_CLIENT_ID_KEY = "meet_tab_client_id";

export function getMeetingClientId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.sessionStorage.getItem(MEETING_CLIENT_ID_KEY);
  if (existing) {
    return existing;
  }

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(MEETING_CLIENT_ID_KEY, generated);
  return generated;
}

export function useMeetingRoom(roomId: string) {
  const meeting = useMeetingStore();
  const websocket = useWebSocket();
  const lastJoinRef = useRef<JoinMeetingInput | null>(null);
  const joinedConnectionIdRef = useRef<number | null>(null);
  const joinSentConnectionIdRef = useRef<number | null>(null);
  const rejoinSentRef = useRef(false);
  useSignalingMessages();

  const sendJoin = useCallback(
    ({ displayName, password }: JoinMeetingInput) => {
      websocket.send({
        payload: {
          client_id: getMeetingClientId(),
          display_name: displayName,
          host_token: getHostToken(roomId) ?? undefined,
          password: password?.trim() || undefined,
          room_id: roomId
        },
        type: "join"
      });
    },
    [roomId, websocket]
  );

  const joinMeeting = useCallback(
    ({ displayName, password }: JoinMeetingInput) => {
      const normalizedDisplayName = displayName.trim();

      if (!normalizedDisplayName) {
        meeting.setError("validation.displayNameRequired");
        return { joinedAsHost: false };
      }

      const hostToken = getHostToken(roomId);
      const joinRequest = {
        displayName: normalizedDisplayName,
        password
      };
      lastJoinRef.current = joinRequest;
      joinedConnectionIdRef.current = null;
      joinSentConnectionIdRef.current = null;
      rejoinSentRef.current = false;

      meeting.beginJoin(roomId);
      websocket.connect();

      return { joinedAsHost: Boolean(hostToken) };
    },
    [meeting, roomId, websocket]
  );

  useLayoutEffect(() => {
    if (
      websocket.status === "open" &&
      meeting.phase === "joining" &&
      lastJoinRef.current &&
      joinSentConnectionIdRef.current !== websocket.connectionId
    ) {
      joinSentConnectionIdRef.current = websocket.connectionId;
      sendJoin(lastJoinRef.current);
      return;
    }

    if (
      websocket.status === "open" &&
      (meeting.phase === "in-call" || meeting.phase === "waiting-approval")
    ) {
      if (joinedConnectionIdRef.current === null) {
        joinedConnectionIdRef.current = websocket.connectionId;
      } else if (
        joinedConnectionIdRef.current !== websocket.connectionId &&
        rejoinSentRef.current
      ) {
        joinedConnectionIdRef.current = websocket.connectionId;
        rejoinSentRef.current = false;
      } else if (
        joinedConnectionIdRef.current !== websocket.connectionId &&
        lastJoinRef.current
      ) {
        rejoinSentRef.current = false;
        meeting.setPhase("reconnecting");
        return;
      }
    }

    const shouldMarkReconnecting =
      (websocket.status === "closed" || websocket.status === "reconnecting") &&
      (meeting.phase === "in-call" || meeting.phase === "waiting-approval");

    if (shouldMarkReconnecting) {
      rejoinSentRef.current = false;
      meeting.setPhase("reconnecting");
      return;
    }

    if (
      websocket.status !== "open" ||
      meeting.phase !== "reconnecting" ||
      !lastJoinRef.current ||
      rejoinSentRef.current
    ) {
      return;
    }

    rejoinSentRef.current = true;
    sendJoin(lastJoinRef.current);
  }, [
    meeting,
    meeting.phase,
    sendJoin,
    websocket.connectionId,
    websocket.status
  ]);

  const cancelJoin = useCallback(() => {
    lastJoinRef.current = null;
    joinedConnectionIdRef.current = null;
    joinSentConnectionIdRef.current = null;
    rejoinSentRef.current = false;
    websocket.close();
    meeting.reset();
  }, [meeting, websocket]);

  const leaveMeeting = useCallback(() => {
    lastJoinRef.current = null;
    joinedConnectionIdRef.current = null;
    joinSentConnectionIdRef.current = null;
    rejoinSentRef.current = false;
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
