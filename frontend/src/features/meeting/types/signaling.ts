/*
Frontend architecture note

File: src\features\meeting\types\signaling.ts
Layer: Meeting Runtime

Responsibility:
- Shared TypeScript definitions for backend WebSocket message payloads and frontend-only derived signaling events.

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

export type PeerMode = "p2p" | "sfu";
export type MediaKind = "audio" | "video" | string;

export interface SignalEnvelope<TType extends string = string, TPayload = unknown> {
  type: TType;
  from?: string;
  to?: string;
  payload?: TPayload;
}

export interface SignalPeer {
  id: string;
  user_id?: string;
  display_name: string;
  mode: PeerMode;
  is_host: boolean;
}

export interface JoinPayload {
  room_id: string;
  display_name: string;
  password?: string;
  host_token?: string;
}

export interface JoinedPayload {
  your_id: string;
  peers: SignalPeer[];
  mode: PeerMode;
  is_host: boolean;
}

export interface WaitingApprovalPayload {
  your_id: string;
}

export interface JoinRequestPayload {
  peer_id: string;
  display_name: string;
}

export interface PeerIdPayload {
  peer_id: string;
}

export interface RejectPeerPayload extends PeerIdPayload {
  reason?: string;
}

export interface JoinRejectedPayload {
  reason?: string;
}

export interface PeerJoinedPayload {
  peer_id: string;
  display_name: string;
  is_host: boolean;
}

export interface SessionDescriptionPayload {
  sdp: string;
}

export interface IceCandidatePayload {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface SfuAnswerPayload {
  session_id: string;
  sdp: string;
}

export interface TurnServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface SfuSwitchPayload {
  session_id: string;
  turn_servers: TurnServerConfig[];
}

export interface SfuRenegotiateNeededPayload {
  session_id: string;
  track_id: string;
  stream_id: string;
  owner_id: string;
  mime_type: string;
}

export interface PeerModeChangedPayload {
  peer_id: string;
  mode: PeerMode;
}

export interface ChatPayload {
  text: string;
}

export interface FileOfferPayload {
  file_id: string;
  name: string;
  size: number;
  mime: string;
}

export interface FileAnswerPayload {
  file_id: string;
  accepted: boolean;
  reason?: string;
}

export interface FileCandidatePayload {
  file_id: string;
  candidate: string;
}

export interface StatsPayload {
  bitrate_kbps: number;
  packet_loss_pct: number;
  rtt_ms: number;
}

export interface MutePeerPayload extends PeerIdPayload {
  kind: MediaKind;
}

export interface MuteRequestPayload {
  kind: MediaKind;
}

export interface KickPeerPayload extends PeerIdPayload {
  reason?: string;
}

export interface KickedPayload {
  reason?: string;
}

export interface SignalErrorPayload {
  message: string;
}

export type OutgoingSignalMessage =
  | SignalEnvelope<"join", JoinPayload>
  | SignalEnvelope<"approve-peer", PeerIdPayload>
  | SignalEnvelope<"reject-peer", RejectPeerPayload>
  | SignalEnvelope<"offer", SessionDescriptionPayload>
  | SignalEnvelope<"answer", SessionDescriptionPayload>
  | SignalEnvelope<"ice-candidate", IceCandidatePayload>
  | SignalEnvelope<"sfu-offer", SessionDescriptionPayload>
  | SignalEnvelope<"sfu-ice-candidate", IceCandidatePayload>
  | SignalEnvelope<"chat", ChatPayload>
  | SignalEnvelope<"file-offer", FileOfferPayload>
  | SignalEnvelope<"file-answer", FileAnswerPayload>
  | SignalEnvelope<"file-candidate", FileCandidatePayload>
  | SignalEnvelope<"stats", StatsPayload>
  | SignalEnvelope<"mute-peer", MutePeerPayload>
  | SignalEnvelope<"kick-peer", KickPeerPayload>;

export type IncomingSignalMessage =
  | SignalEnvelope<"joined", JoinedPayload>
  | SignalEnvelope<"waiting-approval", WaitingApprovalPayload>
  | SignalEnvelope<"join-request", JoinRequestPayload>
  | SignalEnvelope<"join-rejected", JoinRejectedPayload>
  | SignalEnvelope<"peer-joined", PeerJoinedPayload>
  | SignalEnvelope<"peer-left", PeerIdPayload>
  | SignalEnvelope<"room-closed", undefined>
  | SignalEnvelope<"offer", SessionDescriptionPayload>
  | SignalEnvelope<"answer", SessionDescriptionPayload>
  | SignalEnvelope<"ice-candidate", IceCandidatePayload>
  | SignalEnvelope<"sfu-switch", SfuSwitchPayload>
  | SignalEnvelope<"sfu-answer", SfuAnswerPayload>
  | SignalEnvelope<"sfu-ice-candidate", IceCandidatePayload>
  | SignalEnvelope<"sfu-renegotiate-needed", SfuRenegotiateNeededPayload>
  | SignalEnvelope<"peer-mode-changed", PeerModeChangedPayload>
  | SignalEnvelope<"chat", ChatPayload>
  | SignalEnvelope<"file-offer", FileOfferPayload>
  | SignalEnvelope<"file-answer", FileAnswerPayload>
  | SignalEnvelope<"file-candidate", FileCandidatePayload>
  | SignalEnvelope<"mute-request", MuteRequestPayload>
  | SignalEnvelope<"kicked", KickedPayload>
  | SignalEnvelope<"error", SignalErrorPayload>;
