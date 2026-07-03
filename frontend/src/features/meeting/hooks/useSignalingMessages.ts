"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import { isMessageKey, type MessageKey } from "@/lib/i18n/messages";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";
import { useLocale } from "@/providers/LocaleProvider";

const signalErrorKeys: Record<string, MessageKey> = {
  "display_name required": "validation.displayNameRequired",
  "host permission required": "error.hostPermissionRequired",
  "join room before using sfu": "error.joinRoomBeforeUsingSfu",
  "please join a room before using sfu": "error.joinRoomBeforeUsingSfu",
  "room is full": "error.roomFull",
  "room is locked": "error.roomLocked",
  "room not found or expired": "error.roomNotFoundOrExpired",
  "that display name is already in this room. choose another name.":
    "error.displayNameAlreadyInRoom",
  "wrong room password": "error.wrongRoomPassword"
};

function normalizeSignalError(
  message: string | null | undefined,
  fallbackKey: MessageKey = "common.error"
) {
  if (!message) {
    return fallbackKey;
  }

  return signalErrorKeys[message.trim().toLowerCase()] ?? message;
}

export function useSignalingMessages() {
  const { t } = useLocale();
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
          normalizeSignalError(message.payload?.reason, "meeting.joinDeclined")
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
      webSocketManager.subscribe("p2p-switch", () =>
        useMeetingStore.getState().setRoomMode("p2p")
      ),
      webSocketManager.subscribe("sfu-switch", () =>
        useMeetingStore.getState().setRoomMode("sfu")
      ),
      webSocketManager.subscribe("peer-permissions-updated", (message) => {
        store.setPeerPermissions(message.payload.peer_id, message.payload.permissions);
        if (message.payload.peer_id === store.localPeerId) {
          store.setLocalPermissions(message.payload.permissions);
        }
      }),
      webSocketManager.subscribe("admin-updated", (message) => {
        store.setPeerAdmin(
          message.payload.peer_id,
          message.payload.is_admin,
          message.payload.admin_permissions
        );
        if (message.payload.peer_id === store.localPeerId) {
          store.setLocalAdmin(
            message.payload.is_admin,
            message.payload.admin_permissions
          );
        }
      }),
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
          normalizeSignalError(
            message.payload?.reason,
            "meeting.removedFromMeeting"
          )
        );
        store.setPhase("kicked");
      }),
      webSocketManager.subscribe("error", (message) => {
        const currentState = useMeetingStore.getState();

        if (
          currentState.phase === "joining" ||
          currentState.phase === "waiting-approval" ||
          currentState.phase === "reconnecting"
        ) {
          webSocketManager.close();
          currentState.failJoin(normalizeSignalError(message.payload.message));
          return;
        }

        const errorMessage = normalizeSignalError(message.payload.message);
        currentState.setError(errorMessage);
        toast.error(isMessageKey(errorMessage) ? t(errorMessage) : errorMessage);
      })
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [store, t]);
}
