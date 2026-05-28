/*
Frontend architecture note

File: src\features\meeting\stores\meetingStore.ts
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
  beginJoin: (roomId: string) => void;
  joined: (payload: JoinedPayload) => void;
  waitingApproval: (peerId: string) => void;
  addJoinRequest: (payload: JoinRequestPayload) => void;
  addPeer: (payload: PeerJoinedPayload) => void;
  removePendingPeer: (peerId: string) => void;
  removePeer: (payload: PeerIdPayload) => void;
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
      audioEnabled: true,
      screenSharing: false,
      videoEnabled: true
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

  beginJoin: (roomId) => set({ error: null, phase: "joining", roomId }),

  joined: (payload) =>
    set({
      error: null,
      isHost: payload.is_host,
      localPeerId: payload.your_id,
      peers: Object.fromEntries(
        payload.peers.map((peer) => [peer.id, peerFromJoined(peer)])
      ),
      phase: "in-call"
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
            audioEnabled: true,
            screenSharing: false,
            videoEnabled: true
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
      roomId: null
    }),

  setError: (message) => set({ error: message }),
  setPhase: (phase) => set({ phase })
}));
