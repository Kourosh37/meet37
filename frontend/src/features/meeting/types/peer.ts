import type {
  AdminPermissions,
  MediaTrackStatus,
  PeerMode,
  PeerPermissions
} from "@/features/meeting/types/signaling";

export type ConnectionQuality = "unknown" | "good" | "warning" | "poor";

export interface PeerIdentity {
  id: string;
  userId?: string;
  displayName: string;
  isHost: boolean;
  isAdmin?: boolean;
  permissions?: PeerPermissions;
  adminPermissions?: AdminPermissions;
}

export interface PeerMediaState {
  audioEnabled: boolean;
  audioStatus: MediaTrackStatus;
  videoEnabled: boolean;
  videoStatus: MediaTrackStatus;
  screenSharing: boolean;
  screenShareStatus: MediaTrackStatus;
}

export interface PeerConnectionState {
  mode: PeerMode;
  quality: ConnectionQuality;
  iceState?: RTCIceConnectionState;
  connectionState?: RTCPeerConnectionState;
}

export interface MeetingPeer extends PeerIdentity {
  media: PeerMediaState;
  connection: PeerConnectionState;
}

export interface PendingPeer {
  id: string;
  displayName: string;
  requestedAt: number;
}
