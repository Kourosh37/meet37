import type {
  JoinedPayload,
  JoinRequestPayload,
  PeerIdPayload,
  PeerJoinedPayload
} from "@/features/meeting/types/signaling";
import type { MeetingPeer, PendingPeer } from "@/features/meeting/types/peer";
import { create } from "zustand";

const defaultPermissions = {
  can_use_mic: true,
  can_use_camera: true,
  can_share_screen: true,
  can_chat: true,
  can_react: true
};

export type MeetingPhase =
  | "idle"
  | "joining"
  | "waiting-approval"
  | "in-call"
  | "reconnecting"
  | "rejected"
  | "kicked"
  | "room-closed"
  | "left";

export interface MeetingState {
  error: string | null;
  isHost: boolean;
  isAdmin: boolean;
  localPermissions: MeetingPeer["permissions"];
  localAdminPermissions: MeetingPeer["adminPermissions"];
  localPeerId: string | null;
  pendingPeers: PendingPeer[];
  peers: Record<string, MeetingPeer>;
  phase: MeetingPhase;
  roomMode: MeetingPeer["connection"]["mode"];
  roomId: string | null;
  turnServers: JoinedPayload["turn_servers"];
  beginJoin: (roomId: string) => void;
  failJoin: (message: string) => void;
  joined: (payload: JoinedPayload) => void;
  waitingApproval: (peerId: string) => void;
  addJoinRequest: (payload: JoinRequestPayload) => void;
  addPeer: (payload: PeerJoinedPayload) => void;
  removePendingPeer: (peerId: string) => void;
  removePeer: (payload: PeerIdPayload) => void;
  setPeerMedia: (peerId: string, media: Partial<MeetingPeer["media"]>) => void;
  setPeerMode: (
    peerId: string,
    mode: MeetingPeer["connection"]["mode"]
  ) => void;
  setPeerPermissions: (
    peerId: string,
    permissions: MeetingPeer["permissions"]
  ) => void;
  setPeerAdmin: (
    peerId: string,
    isAdmin: boolean,
    adminPermissions?: MeetingPeer["adminPermissions"]
  ) => void;
  setLocalPermissions: (permissions: MeetingPeer["permissions"]) => void;
  setLocalAdmin: (
    isAdmin: boolean,
    adminPermissions?: MeetingPeer["adminPermissions"]
  ) => void;
  setError: (message: string | null) => void;
  setPhase: (phase: MeetingPhase) => void;
  setRoomMode: (mode: MeetingPeer["connection"]["mode"]) => void;
  reset: () => void;
}

function peerFromJoined(payload: JoinedPayload["peers"][number]): MeetingPeer {
  return {
    connection: {
      mode: payload.mode,
      quality: "unknown"
    },
    displayName: payload.display_name,
    id: payload.id,
    isHost: payload.is_host,
    isAdmin: payload.is_admin ?? false,
    permissions: payload.permissions ?? defaultPermissions,
    adminPermissions: payload.admin_permissions,
    media: {
      audioEnabled: false,
      audioStatus: "off",
      screenSharing: false,
      screenShareStatus: "off",
      videoStatus: "off",
      videoEnabled: false
    },
    userId: payload.user_id
  };
}

export const useMeetingStore = create<MeetingState>((set) => ({
  error: null,
  isHost: false,
  isAdmin: false,
  localPermissions: defaultPermissions,
  localAdminPermissions: undefined,
  localPeerId: null,
  pendingPeers: [],
  peers: {},
  phase: "idle",
  roomMode: "p2p",
  roomId: null,
  turnServers: [],

  beginJoin: (roomId) => set({ error: null, phase: "joining", roomId }),

  failJoin: (message) =>
    set((state) => ({
      error: message,
      isHost: false,
      localPeerId: null,
      pendingPeers: [],
      peers: {},
      phase: "idle",
      roomMode: "p2p",
      roomId: state.roomId
    })),

  joined: (payload) =>
    set({
      error: null,
      isHost: payload.is_host,
      isAdmin: payload.is_admin ?? false,
      localPermissions: payload.permissions ?? defaultPermissions,
      localAdminPermissions: payload.admin_permissions,
      localPeerId: payload.your_id,
      peers: Object.fromEntries(
        payload.peers.map((peer) => [peer.id, peerFromJoined(peer)])
      ),
      phase: "in-call",
      roomMode: payload.mode,
      turnServers: payload.turn_servers ?? []
    }),

  waitingApproval: (peerId) =>
    set({ localPeerId: peerId, phase: "waiting-approval" }),

  addJoinRequest: (payload) =>
    set((state) => ({
      pendingPeers: [
        ...state.pendingPeers.filter((peer) => peer.id !== payload.peer_id),
        {
          displayName: payload.display_name,
          id: payload.peer_id,
          requestedAt: Date.now()
        }
      ]
    })),

  addPeer: (payload) =>
    set((state) => ({
      pendingPeers: state.pendingPeers.filter(
        (peer) => peer.id !== payload.peer_id
      ),
      peers: {
        ...state.peers,
        [payload.peer_id]: {
          connection: {
            mode: payload.mode ?? state.roomMode,
            quality: "unknown"
          },
          displayName: payload.display_name,
          id: payload.peer_id,
          isHost: payload.is_host,
          isAdmin: payload.is_admin ?? false,
          permissions: payload.permissions ?? defaultPermissions,
          adminPermissions: payload.admin_permissions,
          media: {
            audioEnabled: false,
            audioStatus: "off",
            screenSharing: false,
            screenShareStatus: "off",
            videoStatus: "off",
            videoEnabled: false
          }
        }
      }
    })),

  removePendingPeer: (peerId) =>
    set((state) => ({
      pendingPeers: state.pendingPeers.filter((peer) => peer.id !== peerId)
    })),

  removePeer: (payload) =>
    set((state) => {
      const { [payload.peer_id]: _removed, ...peers } = state.peers;
      return {
        pendingPeers: state.pendingPeers.filter(
          (peer) => peer.id !== payload.peer_id
        ),
        peers
      };
    }),

  setPeerMedia: (peerId, media) =>
    set((state) => {
      const peer = state.peers[peerId];

      if (!peer) {
        return state;
      }

      return {
        peers: {
          ...state.peers,
          [peerId]: {
            ...peer,
            media: {
              ...peer.media,
              ...media
            }
          }
        }
      };
    }),

  setPeerMode: (peerId, mode) =>
    set((state) => {
      const peer = state.peers[peerId];

      if (!peer) {
        return state;
      }

      return {
        peers: {
          ...state.peers,
          [peerId]: {
            ...peer,
            connection: {
              ...peer.connection,
              mode
            }
          }
        }
      };
    }),

  setPeerPermissions: (peerId, permissions) =>
    set((state) => {
      const peer = state.peers[peerId];

      if (!peer) {
        return state;
      }

      return {
        peers: {
          ...state.peers,
          [peerId]: {
            ...peer,
            permissions: permissions ?? defaultPermissions
          }
        }
      };
    }),

  setPeerAdmin: (peerId, isAdmin, adminPermissions) =>
    set((state) => {
      const peer = state.peers[peerId];

      if (!peer) {
        return state;
      }

      return {
        peers: {
          ...state.peers,
          [peerId]: {
            ...peer,
            isAdmin,
            adminPermissions
          }
        }
      };
    }),

  setLocalPermissions: (permissions) =>
    set({ localPermissions: permissions ?? defaultPermissions }),

  setLocalAdmin: (isAdmin, adminPermissions) =>
    set({ isAdmin, localAdminPermissions: adminPermissions }),

  reset: () =>
    set({
      error: null,
      isHost: false,
      isAdmin: false,
      localPermissions: defaultPermissions,
      localAdminPermissions: undefined,
      localPeerId: null,
      pendingPeers: [],
      peers: {},
      phase: "idle",
      roomMode: "p2p",
      roomId: null,
      turnServers: []
    }),

  setError: (message) => set({ error: message }),
  setPhase: (phase) => set({ phase }),
  setRoomMode: (mode) =>
    set((state) => ({
      roomMode: mode,
      peers: Object.fromEntries(
        Object.entries(state.peers).map(([peerId, peer]) => [
          peerId,
          {
            ...peer,
            connection: {
              ...peer.connection,
              mode
            }
          }
        ])
      )
    }))
}));
