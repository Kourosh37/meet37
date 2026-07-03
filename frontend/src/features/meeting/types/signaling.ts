export type PeerMode = "p2p" | "sfu";
export type MediaKind = "audio" | "video" | string;
export type MediaTrackStatus = "off" | "starting" | "ready" | "error";

export interface PeerPermissions {
  can_use_mic: boolean;
  can_use_camera: boolean;
  can_share_screen: boolean;
  can_chat: boolean;
  can_react: boolean;
}

export interface AdminPermissions {
  can_kick: boolean;
  can_mute_mic: boolean;
  can_disable_camera: boolean;
  can_disable_screen: boolean;
  can_disable_chat: boolean;
  can_disable_emoji: boolean;
  can_manage_bans: boolean;
}

export interface BannedParticipant {
  id: string;
  display_name: string;
  banned_until: number;
  permanent: boolean;
  identity_count: number;
}

export type SignalEnvelope<
  TType extends string = string,
  TPayload = unknown
> = {
  type: TType;
  from?: string;
  to?: string;
} & (TPayload extends undefined
  ? { payload?: undefined }
  : { payload: TPayload });

export interface SignalPeer {
  id: string;
  user_id?: string;
  display_name: string;
  mode: PeerMode;
  is_host: boolean;
  is_admin?: boolean;
  permissions?: PeerPermissions;
  admin_permissions?: AdminPermissions;
}

export interface JoinPayload {
  room_id: string;
  display_name: string;
  password?: string;
  host_token?: string;
  client_id?: string;
}

export interface JoinedPayload {
  your_id: string;
  peers: SignalPeer[];
  mode: PeerMode;
  is_host: boolean;
  is_admin?: boolean;
  permissions?: PeerPermissions;
  admin_permissions?: AdminPermissions;
  turn_servers?: TurnServerConfig[];
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
  mode?: PeerMode;
  is_host: boolean;
  is_admin?: boolean;
  permissions?: PeerPermissions;
  admin_permissions?: AdminPermissions;
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

export interface MediaStatePayload {
  audio_enabled: boolean;
  audio_status?: MediaTrackStatus;
  screen_sharing?: boolean;
  screen_share_status?: MediaTrackStatus;
  video_enabled: boolean;
  video_status?: MediaTrackStatus;
}

export interface AudioLevelPayload {
  level: number;
}

export interface PingPayload {
  id: string;
}

export interface ReactionPayload {
  display_name?: string;
  emoji: string;
  peer_id?: string;
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

export interface FileStartPayload {
  file_id: string;
  mime: string;
  name: string;
  size: number;
  total_chunks: number;
}

export interface FileChunkPayload {
  bytes_base64: string;
  file_id: string;
  index: number;
  total_chunks: number;
}

export interface FileCompletePayload {
  file_id: string;
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
  ban_minutes?: number;
  ban_permanent?: boolean;
}

export interface KickedPayload {
  reason?: string;
  ban_until?: number;
  ban_permanent?: boolean;
}

export interface BanListPayload {
  bans: BannedParticipant[];
}

export interface UnbanPeerPayload {
  ban_id: string;
}

export interface PeerPermissionsPayload extends PeerIdPayload {
  permissions: PeerPermissions;
}

export interface AdminPermissionsPayload extends PeerIdPayload {
  is_admin: boolean;
  admin_permissions: AdminPermissions;
}

export interface RoomSettingsPayload {
  join_policy?: "open" | "approval";
  password?: string;
  has_password?: boolean;
  permissions?: PeerPermissions;
  apply_to_existing?: boolean;
}

export interface SignalErrorPayload {
  message: string;
}

export type OutgoingSignalMessage =
  | SignalEnvelope<"join", JoinPayload>
  | SignalEnvelope<"leave", undefined>
  | SignalEnvelope<"offer", SessionDescriptionPayload>
  | SignalEnvelope<"answer", SessionDescriptionPayload>
  | SignalEnvelope<"ice-candidate", IceCandidatePayload>
  | SignalEnvelope<"approve-peer", PeerIdPayload>
  | SignalEnvelope<"reject-peer", RejectPeerPayload>
  | SignalEnvelope<"sfu-offer", SessionDescriptionPayload>
  | SignalEnvelope<"sfu-ice-candidate", IceCandidatePayload>
  | SignalEnvelope<"chat", ChatPayload>
  | SignalEnvelope<"ping", PingPayload>
  | SignalEnvelope<"reaction", ReactionPayload>
  | SignalEnvelope<"media-state", MediaStatePayload>
  | SignalEnvelope<"audio-level", AudioLevelPayload>
  | SignalEnvelope<"file-offer", FileOfferPayload>
  | SignalEnvelope<"file-answer", FileAnswerPayload>
  | SignalEnvelope<"file-start", FileStartPayload>
  | SignalEnvelope<"file-chunk", FileChunkPayload>
  | SignalEnvelope<"file-complete", FileCompletePayload>
  | SignalEnvelope<"stats", StatsPayload>
  | SignalEnvelope<"mute-peer", MutePeerPayload>
  | SignalEnvelope<"kick-peer", KickPeerPayload>
  | SignalEnvelope<"list-bans", undefined>
  | SignalEnvelope<"unban-peer", UnbanPeerPayload>
  | SignalEnvelope<"set-peer-permissions", PeerPermissionsPayload>
  | SignalEnvelope<"set-admin-permissions", AdminPermissionsPayload>
  | SignalEnvelope<"set-room-settings", RoomSettingsPayload>;

export type IncomingSignalMessage =
  | SignalEnvelope<"joined", JoinedPayload>
  | SignalEnvelope<"waiting-approval", WaitingApprovalPayload>
  | SignalEnvelope<"join-request", JoinRequestPayload>
  | SignalEnvelope<"join-rejected", JoinRejectedPayload>
  | SignalEnvelope<"peer-joined", PeerJoinedPayload>
  | SignalEnvelope<"peer-left", PeerIdPayload>
  | SignalEnvelope<"room-closed", undefined>
  | SignalEnvelope<"p2p-switch", undefined>
  | SignalEnvelope<"offer", SessionDescriptionPayload>
  | SignalEnvelope<"answer", SessionDescriptionPayload>
  | SignalEnvelope<"ice-candidate", IceCandidatePayload>
  | SignalEnvelope<"sfu-switch", SfuSwitchPayload>
  | SignalEnvelope<"sfu-answer", SfuAnswerPayload>
  | SignalEnvelope<"sfu-ice-candidate", IceCandidatePayload>
  | SignalEnvelope<"sfu-renegotiate-needed", SfuRenegotiateNeededPayload>
  | SignalEnvelope<"peer-mode-changed", PeerModeChangedPayload>
  | SignalEnvelope<"chat", ChatPayload>
  | SignalEnvelope<"pong", PingPayload>
  | SignalEnvelope<"reaction", ReactionPayload>
  | SignalEnvelope<"media-state", MediaStatePayload>
  | SignalEnvelope<"audio-level", AudioLevelPayload>
  | SignalEnvelope<"file-offer", FileOfferPayload>
  | SignalEnvelope<"file-answer", FileAnswerPayload>
  | SignalEnvelope<"file-start", FileStartPayload>
  | SignalEnvelope<"file-chunk", FileChunkPayload>
  | SignalEnvelope<"file-complete", FileCompletePayload>
  | SignalEnvelope<"mute-request", MuteRequestPayload>
  | SignalEnvelope<"kicked", KickedPayload>
  | SignalEnvelope<"ban-list", BanListPayload>
  | SignalEnvelope<"peer-permissions-updated", PeerPermissionsPayload>
  | SignalEnvelope<"admin-updated", AdminPermissionsPayload>
  | SignalEnvelope<"room-settings-updated", RoomSettingsPayload>
  | SignalEnvelope<"error", SignalErrorPayload>;
