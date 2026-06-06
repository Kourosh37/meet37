"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import type {
  AdminPermissions,
  MediaKind,
  PeerPermissions
} from "@/features/meeting/types/signaling";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

export function useModeration() {
  const isHost = useMeetingStore((state) => state.isHost);
  const isAdmin = useMeetingStore((state) => state.isAdmin);
  const adminPermissions = useMeetingStore(
    (state) => state.localAdminPermissions
  );
  const pendingPeers = useMeetingStore((state) => state.pendingPeers);
  const removePendingPeer = useMeetingStore((state) => state.removePendingPeer);

  const canKick = isHost || Boolean(adminPermissions?.can_kick);
  const canMuteMic = isHost || Boolean(adminPermissions?.can_mute_mic);
  const canDisableCamera = isHost || Boolean(adminPermissions?.can_disable_camera);
  const canDisableScreen = isHost || Boolean(adminPermissions?.can_disable_screen);
  const canDisableChat = isHost || Boolean(adminPermissions?.can_disable_chat);
  const canDisableEmoji = isHost || Boolean(adminPermissions?.can_disable_emoji);

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
      if (kind === "audio" && !canMuteMic) {
        return;
      }

      if (kind === "video" && !canDisableCamera) {
        return;
      }

      if (kind === "screen" && !canDisableScreen) {
        return;
      }

      webSocketManager.send({
        payload: { kind, peer_id: peerId },
        type: "mute-peer"
      });
      toast.info("Mute request sent");
    },
    [canDisableCamera, canDisableScreen, canMuteMic]
  );

  const kickPeer = useCallback(
    (
      peerId: string,
      reason = "Removed by the host.",
      banMinutes?: number,
      banPermanent?: boolean
    ) => {
      if (!canKick) {
        return;
      }

      webSocketManager.send({
        payload: {
          ban_minutes: banMinutes,
          ban_permanent: banPermanent,
          peer_id: peerId,
          reason
        },
        type: "kick-peer"
      });
    },
    [canKick]
  );

  const setPeerPermissions = useCallback(
    (peerId: string, permissions: PeerPermissions) => {
      if (!isHost && !isAdmin) {
        return;
      }

      webSocketManager.send({
        payload: { peer_id: peerId, permissions },
        type: "set-peer-permissions"
      });
    },
    [isAdmin, isHost]
  );

  const setAdminPermissions = useCallback(
    (peerId: string, isAdminTarget: boolean, permissions: AdminPermissions) => {
      if (!isHost) {
        return;
      }

      webSocketManager.send({
        payload: {
          admin_permissions: permissions,
          is_admin: isAdminTarget,
          peer_id: peerId
        },
        type: "set-admin-permissions"
      });
    },
    [isHost]
  );

  const updateRoomSettings = useCallback(
    (settings: {
      joinPolicy?: "open" | "approval";
      password?: string;
      permissions?: PeerPermissions;
      applyToExisting?: boolean;
    }) => {
      if (!isHost) {
        return;
      }

      webSocketManager.send({
        payload: {
          apply_to_existing: settings.applyToExisting,
          join_policy: settings.joinPolicy,
          password: settings.password,
          permissions: settings.permissions
        },
        type: "set-room-settings"
      });
    },
    [isHost]
  );

  return {
    approvePeer,
    canModerate: isHost || isAdmin,
    canDisableCamera,
    canDisableChat,
    canDisableEmoji,
    canDisableScreen,
    canKick,
    canMuteMic,
    kickPeer,
    mutePeer,
    pendingPeers,
    rejectPeer
    ,
    setAdminPermissions,
    setPeerPermissions,
    updateRoomSettings
  };
}
