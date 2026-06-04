import type {
  PeerMode,
  TurnServerConfig
} from "@/features/meeting/types/signaling";

export type LocalMediaPermissionState =
  | "idle"
  | "prompting"
  | "granted"
  | "denied"
  | "error";

export interface LocalMediaPreferences {
  audioEnabled: boolean;
  videoEnabled: boolean;
  selectedAudioDeviceId?: string;
  selectedVideoDeviceId?: string;
}

export interface LocalMediaState extends LocalMediaPreferences {
  permissionState: LocalMediaPermissionState;
  stream?: MediaStream;
  error?: string;
}

export interface RemoteTrackState {
  peerId: string;
  streamId: string;
  trackId: string;
  kind: MediaStreamTrack["kind"];
  stream?: MediaStream;
}

export interface PeerConnectionRecord {
  peerId: string;
  mode: PeerMode;
  connection: RTCPeerConnection;
}

export interface SfuSessionState {
  active: boolean;
  sessionId?: string;
  turnServers: TurnServerConfig[];
  connection?: RTCPeerConnection;
}

export interface QualityStatsSnapshot {
  bitrateKbps: number;
  packetLossPct: number;
  rttMs: number;
  jitterMs?: number;
  timestamp: number;
}
