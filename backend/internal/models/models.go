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
	ID          string `json:"id"`
	UserID      string `json:"user_id,omitempty"`
	DisplayName string `json:"display_name"`
	Mode        string `json:"mode"`
	IsHost      bool   `json:"is_host"`
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
}

type StatsReport struct {
	BitrateKbps   float64 `json:"bitrate_kbps"`
	PacketLossPct float64 `json:"packet_loss_pct"`
	RTTMs         float64 `json:"rtt_ms"`
}
