import type {
  JoinedPayload,
  JoinRequestPayload,
  PeerIdPayload,
  PeerJoinedPayload
} from "@/features/meeting/types/signaling";
import type { MeetingPeer, PendingPeer } from "@/features/meeting/types/peer";
import { create } from "zustand";

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
  localPeerId: string | null;
  pendingPeers: PendingPeer[];
  peers: Record<string, MeetingPeer>;
  phase: MeetingPhase;
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
  setError: (message: string | null) => void;
  setPhase: (phase: MeetingPhase) => void;
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
  localPeerId: null,
  pendingPeers: [],
  peers: {},
  phase: "idle",
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
      roomId: state.roomId
    })),

  joined: (payload) =>
    set({
      error: null,
      isHost: payload.is_host,
      localPeerId: payload.your_id,
      peers: Object.fromEntries(
        payload.peers.map((peer) => [peer.id, peerFromJoined(peer)])
      ),
      phase: "in-call",
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
            mode: "p2p",
            quality: "unknown"
          },
          displayName: payload.display_name,
          id: payload.peer_id,
          isHost: payload.is_host,
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

  reset: () =>
    set({
      error: null,
      isHost: false,
      localPeerId: null,
      pendingPeers: [],
      peers: {},
      phase: "idle",
      roomId: null,
      turnServers: []
    }),

  setError: (message) => set({ error: message }),
  setPhase: (phase) => set({ phase })
}));
