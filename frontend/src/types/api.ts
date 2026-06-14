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
  room_id?: string;
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
  sfu_peers: number;
  has_sfu_session: boolean;
}

export type AdminAnalyticsRange = "today" | "7d" | "30d";

export interface AdminAnalyticsPoint {
  label: string;
  start: UnixSeconds;
  end: UnixSeconds;
  count: number;
}

export interface AdminAnalyticsSeries {
  total: number;
  series: AdminAnalyticsPoint[];
}

export interface AdminAnalyticsResponse {
  range: AdminAnalyticsRange;
  users: AdminAnalyticsSeries;
  rooms: AdminAnalyticsSeries;
}

export interface AdminServerResource {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  percent: number;
}

export interface AdminServerStatusResponse {
  collected_at: UnixSeconds;
  cpu: {
    percent: number;
    cores: number;
  };
  memory: AdminServerResource;
  disk: AdminServerResource & {
    path: string;
  };
  runtime: {
    heap_alloc_bytes: number;
    goroutines: number;
  };
}

export interface LiveRoomPeerDetail {
  id: string;
  user_id?: string;
  display_name: string;
  mode: string;
  is_host: boolean;
  is_admin: boolean;
  audio_enabled: boolean;
  audio_status: string;
  video_enabled: boolean;
  video_status: string;
  screen_sharing: boolean;
  screen_share_status: string;
  media_updated_at?: UnixSeconds;
}

export interface LiveRoomResourceEstimate {
  estimated_cpu_percent: number;
  estimated_memory_bytes: number;
  share_of_active_peers: number;
  total_active_peer_count: number;
  room_active_peer_count: number;
  estimate_basis: string;
}

export interface AdminRoomDetailResponse extends LiveRoomStats {
  peers: LiveRoomPeerDetail[];
  resources: LiveRoomResourceEstimate;
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
