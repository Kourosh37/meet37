/*
Frontend architecture note

File: src\types\api.ts
Layer: Shared Types

Responsibility:
- Shared TypeScript definitions mirroring backend REST request and response payloads. Runtime validation belongs in validators.ts, not here.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: keep this file aligned with backend/docs/API.md and backend/docs/WEBSOCKET.md when it touches server data or signaling.

State model to plan: loading, ready, empty, recoverable error, fatal error, and cleanup/unmount behavior where applicable.

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

Future tests: success path, loading path, error path, accessibility expectations, and cleanup/side-effect boundaries.

*/

export type UnixSeconds = number;

export interface ApiErrorBody {
  error: string;
}

export interface AuthLoginRequest {
  username: string;
  password: string;
}

export interface AuthRefreshRequest {
  refresh_token: string;
}

export interface AuthLogoutRequest {
  refresh_token: string;
}

export interface AuthResponse {
  token: string;
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_at: UnixSeconds;
  refresh_expires_at: UnixSeconds;
  user_id: string;
  username: string;
  is_admin: boolean;
}

export type AppMode = "public" | "private";

export interface AdminSettingsResponse {
  app_mode: AppMode;
}

export interface UpdateAdminSettingsRequest {
  app_mode: AppMode;
}

export interface AdminUser {
  id: string;
  username: string;
  created_at: UnixSeconds;
}

export interface CreateAdminUserRequest {
  username: string;
  password: string;
}

export interface UpdateAdminUserRequest {
  username?: string;
  password?: string;
}

export type JoinPolicy = "open" | "approval";

export interface Room {
  id: string;
  name: string;
  host_id: string;
  is_locked: boolean;
  has_password: boolean;
  join_policy: JoinPolicy;
  max_peers: number;
  created_at: UnixSeconds;
  expires_at?: UnixSeconds;
}

export interface CreateRoomRequest {
  name: string;
  password?: string;
  join_policy?: JoinPolicy;
  max_peers?: number;
  expires_in?: number;
}

export interface CreateRoomResponse {
  room: Room;
  host_token: string;
}

export interface LiveRoomStats {
  active: boolean;
  peer_count: number;
  pending_count: number;
  p2p_peers: number;
  sfu_peers: number;
  has_sfu_session: boolean;
}

export interface RoomDetailsResponse {
  room: Room;
  live: LiveRoomStats;
}

export interface ChatHistoryItem {
  id: number;
  room_id: string;
  peer_id: string;
  user_id: string;
  display_name: string;
  text: string;
  ts: UnixSeconds;
}

export type FileTransferStatus = "offered" | "answered" | "rejected";

export interface FileHistoryItem {
  id: number;
  room_id: string;
  file_id: string;
  sender_peer_id: string;
  target_peer_id: string;
  name: string;
  size: number;
  mime: string;
  status: FileTransferStatus;
  reason: string;
  ts: UnixSeconds;
}

export interface SfuSessionStats {
  peer_count: number;
  track_count: number;
  packets_relayed: number;
  bytes_relayed: number;
  recordings: number;
}

export interface AdminSfuStatsResponse {
  session_count: number;
  sessions: Record<string, SfuSessionStats>;
}
