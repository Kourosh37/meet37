package models

type AppMode string

const (
	AppModePublic  AppMode = "public"
	AppModePrivate AppMode = "private"
)

type User struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	CreatedAt int64  `json:"created_at"`
}

type Room struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	HostID     string `json:"host_id"`
	IsLocked   bool   `json:"is_locked"`
	HasPass    bool   `json:"has_password"`
	JoinPolicy string `json:"join_policy"`
	MaxPeers   int    `json:"max_peers"`
	CreatedAt  int64  `json:"created_at"`
	ExpiresAt  *int64 `json:"expires_at,omitempty"`
}

type PeerInfo struct {
	ID          string            `json:"id"`
	UserID      string            `json:"user_id,omitempty"`
	DisplayName string            `json:"display_name"`
	Mode        string            `json:"mode"`
	IsHost      bool              `json:"is_host"`
	IsAdmin     bool              `json:"is_admin"`
	Permissions *PeerPermissions  `json:"permissions,omitempty"`
	Admin       *AdminPermissions `json:"admin_permissions,omitempty"`
}

type PeerPermissions struct {
	CanUseMic      bool `json:"can_use_mic"`
	CanUseCamera   bool `json:"can_use_camera"`
	CanShareScreen bool `json:"can_share_screen"`
	CanChat        bool `json:"can_chat"`
	CanReact       bool `json:"can_react"`
}

type AdminPermissions struct {
	CanKick          bool `json:"can_kick"`
	CanMuteMic       bool `json:"can_mute_mic"`
	CanDisableCamera bool `json:"can_disable_camera"`
	CanDisableScreen bool `json:"can_disable_screen"`
	CanDisableChat   bool `json:"can_disable_chat"`
	CanDisableEmoji  bool `json:"can_disable_emoji"`
	CanManageBans    bool `json:"can_manage_bans"`
}

type SignalMessage struct {
	Type    string      `json:"type"`
	From    string      `json:"from,omitempty"`
	To      string      `json:"to,omitempty"`
	Payload interface{} `json:"payload,omitempty"`
}

type JoinRequest struct {
	RoomID      string `json:"room_id"`
	Password    string `json:"password,omitempty"`
	DisplayName string `json:"display_name"`
	HostToken   string `json:"host_token,omitempty"`
	ClientID    string `json:"client_id,omitempty"`
}

type StatsReport struct {
	BitrateKbps   float64 `json:"bitrate_kbps"`
	PacketLossPct float64 `json:"packet_loss_pct"`
	RTTMs         float64 `json:"rtt_ms"`
}

type ChatMessage struct {
	ID          int64  `json:"id"`
	RoomID      string `json:"room_id"`
	PeerID      string `json:"peer_id"`
	UserID      string `json:"user_id,omitempty"`
	DisplayName string `json:"display_name"`
	Text        string `json:"text"`
	Timestamp   int64  `json:"ts"`
}

type FileTransfer struct {
	ID           int64  `json:"id"`
	RoomID       string `json:"room_id"`
	FileID       string `json:"file_id"`
	SenderPeerID string `json:"sender_peer_id"`
	TargetPeerID string `json:"target_peer_id,omitempty"`
	Name         string `json:"name,omitempty"`
	Size         int64  `json:"size,omitempty"`
	MIME         string `json:"mime,omitempty"`
	Status       string `json:"status"`
	Reason       string `json:"reason,omitempty"`
	Timestamp    int64  `json:"ts"`
}
