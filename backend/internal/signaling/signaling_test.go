package signaling

import (
	"encoding/json"
	"testing"
	"time"

	"meet-backend/internal/config"
	"meet-backend/internal/db"
	"meet-backend/internal/models"
	"meet-backend/internal/sfu"
)

func testHub(t *testing.T) (*Hub, *db.DB) {
	t.Helper()
	cfg := &config.Config{
		JWTSecret:    "test-secret",
		TURNPublicIP: "127.0.0.1",
		TURNPort:     3478,
		TURNSecret:   "turn-secret",
	}
	database, err := db.Open(t.TempDir()+"/meet.db", "public")
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	return NewHub(cfg, database, sfu.NewManager(cfg), nil), database
}

func TestHandleMessageRelaysDirectPeerSignaling(t *testing.T) {
	hub, _ := testHub(t)
	roomID := "room-1"
	peer := &Peer{id: "peer-1", roomID: roomID, mode: "p2p", send: make(chan []byte, 4), hub: hub}
	target := &Peer{id: "peer-2", roomID: roomID, mode: "p2p", send: make(chan []byte, 4), hub: hub}
	hub.rooms[roomID] = &Room{id: roomID, peers: map[string]*Peer{peer.id: peer, target.id: target}, pending: map[string]*Peer{}, permissions: map[string]models.PeerPermissions{}, adminPermissions: map[string]models.AdminPermissions{}, bans: map[string]int64{}, defaultPermissions: defaultPeerPermissions()}

	hub.handleMessage(peer, []byte(`{"type":"offer","to":"peer-2","payload":{"sdp":"direct-offer"}}`))

	select {
	case raw := <-target.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode signal: %v", err)
		}
		if msg.Type != "offer" || msg.From != "peer-1" || msg.To != "peer-2" {
			t.Fatalf("expected relayed offer, got %#v", msg)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for relayed offer")
	}
}

func TestSyncRoomMediaModeSwitchesAtFourthPeer(t *testing.T) {
	hub, _ := testHub(t)
	roomID := "room-1"
	room := &Room{
		id:                 roomID,
		peers:              map[string]*Peer{},
		pending:            map[string]*Peer{},
		permissions:        map[string]models.PeerPermissions{},
		adminPermissions:   map[string]models.AdminPermissions{},
		bans:               map[string]int64{},
		defaultPermissions: defaultPeerPermissions(),
	}
	hub.rooms[roomID] = room

	for index := 1; index <= p2pMaxPeers; index++ {
		id := "peer-" + string(rune('0'+index))
		room.peers[id] = &Peer{id: id, roomID: roomID, mode: "p2p", send: make(chan []byte, 4), hub: hub}
	}
	hub.syncRoomMediaMode(roomID)
	for _, peer := range room.peers {
		if peer.mode != "p2p" {
			t.Fatalf("expected peer to remain p2p below threshold, got %q", peer.mode)
		}
		select {
		case raw := <-peer.send:
			t.Fatalf("unexpected signal below threshold: %s", string(raw))
		default:
		}
	}

	fourth := &Peer{id: "peer-4", roomID: roomID, mode: "p2p", send: make(chan []byte, 4), hub: hub}
	room.peers[fourth.id] = fourth
	hub.syncRoomMediaMode(roomID)
	for _, peer := range room.peers {
		if peer.mode != "sfu" {
			t.Fatalf("expected peer to switch to sfu, got %q", peer.mode)
		}
		foundSwitch := false
		deadline := time.After(time.Second)
		for !foundSwitch {
			select {
			case raw := <-peer.send:
				var msg models.SignalMessage
				if err := json.Unmarshal(raw, &msg); err != nil {
					t.Fatalf("decode switch signal: %v", err)
				}
				foundSwitch = msg.Type == "sfu-switch"
			case <-deadline:
				t.Fatalf("timed out waiting for sfu-switch")
			}
		}
	}
}

func TestSyncRoomMediaModeDowngradesToP2PBelowThreshold(t *testing.T) {
	hub, _ := testHub(t)
	roomID := "room-1"
	room := &Room{
		id:                 roomID,
		peers:              map[string]*Peer{},
		pending:            map[string]*Peer{},
		permissions:        map[string]models.PeerPermissions{},
		adminPermissions:   map[string]models.AdminPermissions{},
		bans:               map[string]int64{},
		defaultPermissions: defaultPeerPermissions(),
	}
	hub.rooms[roomID] = room
	for index := 1; index <= p2pMaxPeers; index++ {
		id := "peer-" + string(rune('0'+index))
		room.peers[id] = &Peer{id: id, roomID: roomID, mode: "sfu", send: make(chan []byte, 8), hub: hub}
	}

	hub.syncRoomMediaMode(roomID)
	for _, peer := range room.peers {
		if peer.mode != "p2p" {
			t.Fatalf("expected peer to switch back to p2p, got %q", peer.mode)
		}
		foundSwitch := false
		deadline := time.After(time.Second)
		for !foundSwitch {
			select {
			case raw := <-peer.send:
				var msg models.SignalMessage
				if err := json.Unmarshal(raw, &msg); err != nil {
					t.Fatalf("decode switch signal: %v", err)
				}
				foundSwitch = msg.Type == "p2p-switch"
			case <-deadline:
				t.Fatalf("timed out waiting for p2p-switch")
			}
		}
	}
}

func TestHandleMessagePersistsChatAndFileMetadata(t *testing.T) {
	hub, database := testHub(t)
	roomID := "room-1"
	peer := &Peer{id: "peer-1", roomID: roomID, displayName: "Alice", permissions: defaultPeerPermissions(), send: make(chan []byte, 4), hub: hub}
	_, err := database.Exec(
		`INSERT INTO rooms (id, name, host_id, join_policy, max_peers, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		roomID, "Room", "host", "open", 50, time.Now().Unix(),
	)
	if err != nil {
		t.Fatalf("insert room: %v", err)
	}
	hub.rooms[roomID] = &Room{id: roomID, peers: map[string]*Peer{peer.id: peer}, pending: map[string]*Peer{}, permissions: map[string]models.PeerPermissions{}, adminPermissions: map[string]models.AdminPermissions{}, bans: map[string]int64{}, defaultPermissions: defaultPeerPermissions()}

	hub.handleMessage(peer, []byte(`{"type":"chat","payload":{"text":"hello"}}`))
	hub.handleMessage(peer, []byte(`{"type":"file-offer","to":"peer-2","payload":{"file_id":"file-1","name":"notes.txt","size":10,"mime":"text/plain"}}`))
	hub.handleMessage(peer, []byte(`{"type":"file-offer","to":"peer-2","payload":{"file_id":"file-1","name":"notes.txt","size":10,"mime":"text/plain"}}`))
	hub.handleMessage(peer, []byte(`{"type":"file-answer","to":"peer-2","payload":{"file_id":"file-1","accepted":false,"reason":"no"}}`))

	var chatCount int
	if err := database.QueryRow(`SELECT COUNT(*) FROM chat_messages WHERE room_id = ? AND text = ?`, roomID, "hello").Scan(&chatCount); err != nil {
		t.Fatalf("count chat: %v", err)
	}
	if chatCount != 1 {
		t.Fatalf("expected one chat row, got %d", chatCount)
	}

	var rejectedCount int
	if err := database.QueryRow(`SELECT COUNT(*) FROM file_transfers WHERE room_id = ? AND status = ?`, roomID, "rejected").Scan(&rejectedCount); err != nil {
		t.Fatalf("count rejected transfer: %v", err)
	}
	if rejectedCount != 1 {
		t.Fatalf("expected one rejected transfer row, got %d", rejectedCount)
	}
	var transferCount int
	if err := database.QueryRow(`SELECT COUNT(*) FROM file_transfers WHERE room_id = ? AND file_id = ?`, roomID, "file-1").Scan(&transferCount); err != nil {
		t.Fatalf("count transfer: %v", err)
	}
	if transferCount != 1 {
		t.Fatalf("expected duplicate file offers to upsert one row, got %d", transferCount)
	}
}

func TestHandleMessageBroadcastsReactionWithDisplayName(t *testing.T) {
	hub, _ := testHub(t)
	roomID := "room-1"
	sender := &Peer{id: "peer-1", roomID: roomID, displayName: "Alice", permissions: defaultPeerPermissions(), send: make(chan []byte, 4), hub: hub}
	receiver := &Peer{id: "peer-2", roomID: roomID, displayName: "Bob", permissions: defaultPeerPermissions(), send: make(chan []byte, 4), hub: hub}
	hub.rooms[roomID] = &Room{
		id:                 roomID,
		peers:              map[string]*Peer{sender.id: sender, receiver.id: receiver},
		pending:            map[string]*Peer{},
		permissions:        map[string]models.PeerPermissions{},
		adminPermissions:   map[string]models.AdminPermissions{},
		bans:               map[string]int64{},
		defaultPermissions: defaultPeerPermissions(),
	}

	hub.handleMessage(sender, []byte(`{"type":"reaction","payload":{"emoji":"👏"}}`))

	select {
	case raw := <-receiver.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode signal: %v", err)
		}
		if msg.Type != "reaction" || msg.From != sender.id {
			t.Fatalf("unexpected signal: %#v", msg)
		}
		payload, ok := msg.Payload.(map[string]interface{})
		if !ok {
			t.Fatalf("unexpected payload type: %#v", msg.Payload)
		}
		if payload["emoji"] != "👏" || payload["display_name"] != "Alice" || payload["peer_id"] != sender.id {
			t.Fatalf("unexpected reaction payload: %#v", payload)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for reaction")
	}

	select {
	case raw := <-sender.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode sender signal: %v", err)
		}
		if msg.Type != "chat" {
			t.Fatalf("sender should only receive reaction chat, got %q: %s", msg.Type, string(raw))
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for sender reaction chat")
	}

	var chatCount int
	if err := hub.db.QueryRow(`SELECT COUNT(*) FROM chat_messages WHERE room_id = ? AND text LIKE ?`, roomID, "%reacted%").Scan(&chatCount); err != nil {
		t.Fatalf("count reaction chat: %v", err)
	}
	if chatCount != 1 {
		t.Fatalf("expected one reaction chat row, got %d", chatCount)
	}
}

func TestHandleJoinPromotesFirstPeerInReusableRoomToHost(t *testing.T) {
	hub, database := testHub(t)
	roomID := "room-1"
	_, err := database.Exec(
		`INSERT INTO rooms (id, name, host_id, join_policy, max_peers, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		roomID, "Room", "previous-host", "approval", 50, time.Now().Unix(),
	)
	if err != nil {
		t.Fatalf("insert room: %v", err)
	}
	peer := &Peer{id: "peer-1", mode: "sfu", send: make(chan []byte, 4), hub: hub}

	hub.handleMessage(peer, []byte(`{"type":"join","payload":{"room_id":"room-1","display_name":"Alice"}}`))

	select {
	case raw := <-peer.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode signal: %v", err)
		}
		if msg.Type != "joined" {
			t.Fatalf("expected joined signal, got %q", msg.Type)
		}
		payload, ok := msg.Payload.(map[string]interface{})
		if !ok {
			t.Fatalf("unexpected payload type: %#v", msg.Payload)
		}
		if payload["is_host"] != true {
			t.Fatalf("expected first peer to join as host, got payload %#v", payload)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for joined signal")
	}

	if !peer.isHost {
		t.Fatalf("expected peer host flag to be true")
	}
}

func TestHandleJoinKeepsPromotedHostByClientIDAcrossReconnect(t *testing.T) {
	hub, database := testHub(t)
	roomID := "room-1"
	_, err := database.Exec(
		`INSERT INTO rooms (id, name, host_id, join_policy, max_peers, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		roomID, "Room", "previous-host", "open", 50, time.Now().Unix(),
	)
	if err != nil {
		t.Fatalf("insert room: %v", err)
	}

	host := &Peer{id: "host-1", mode: "sfu", send: make(chan []byte, 8), hub: hub}
	hub.handleMessage(host, []byte(`{"type":"join","payload":{"room_id":"room-1","display_name":"Alice","client_id":"client-host-1"}}`))
	select {
	case raw := <-host.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode host join signal: %v", err)
		}
		if msg.Type != "joined" || !host.isHost {
			t.Fatalf("expected promoted host join, got %q host=%v", msg.Type, host.isHost)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for host joined signal")
	}

	guest := &Peer{id: "guest-1", mode: "sfu", send: make(chan []byte, 8), hub: hub}
	hub.handleMessage(guest, []byte(`{"type":"join","payload":{"room_id":"room-1","display_name":"Bob","client_id":"client-guest-1"}}`))
	select {
	case raw := <-guest.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode guest join signal: %v", err)
		}
		if msg.Type != "joined" {
			t.Fatalf("expected guest joined signal, got %q", msg.Type)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for guest joined signal")
	}

	hub.removePeer(host)

	rejoinedHost := &Peer{id: "host-2", mode: "sfu", send: make(chan []byte, 8), hub: hub}
	hub.handleMessage(rejoinedHost, []byte(`{"type":"join","payload":{"room_id":"room-1","display_name":"Renamed Alice","client_id":"client-host-1"}}`))

	select {
	case raw := <-rejoinedHost.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode rejoined host signal: %v", err)
		}
		if msg.Type != "joined" {
			t.Fatalf("expected rejoined host joined signal, got %q", msg.Type)
		}
		payload, ok := msg.Payload.(map[string]interface{})
		if !ok {
			t.Fatalf("unexpected payload type: %#v", msg.Payload)
		}
		if payload["is_host"] != true || !rejoinedHost.isHost {
			t.Fatalf("expected rejoined browser to stay host, got payload %#v host=%v", payload, rejoinedHost.isHost)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for rejoined host signal")
	}
}

func TestHandleJoinRejectsBannedConnectionAfterDisplayNameChange(t *testing.T) {
	hub, database := testHub(t)
	roomID := "room-1"
	_, err := database.Exec(
		`INSERT INTO rooms (id, name, host_id, join_policy, max_peers, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		roomID, "Room", "previous-host", "open", 50, time.Now().Unix(),
	)
	if err != nil {
		t.Fatalf("insert room: %v", err)
	}
	_, err = database.Exec(
		`INSERT INTO room_bans (room_id, identity, banned_until, created_at) VALUES (?, ?, ?, ?)`,
		roomID, "ip:203.0.113.10", time.Now().Add(time.Hour).Unix(), time.Now().Unix(),
	)
	if err != nil {
		t.Fatalf("insert ban: %v", err)
	}
	peer := &Peer{
		id:        "peer-1",
		mode:      "sfu",
		remoteIP:  "203.0.113.10",
		send:      make(chan []byte, 4),
		userAgent: "Test Browser",
		hub:       hub,
	}

	hub.handleMessage(peer, []byte(`{"type":"join","payload":{"room_id":"room-1","display_name":"Changed Name","client_id":"client-12345"}}`))

	select {
	case raw := <-peer.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode signal: %v", err)
		}
		if msg.Type != "error" {
			t.Fatalf("expected banned join error, got %q", msg.Type)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for banned join error")
	}
}

func TestHandleUnbanPeerRemovesBanGroup(t *testing.T) {
	hub, database := testHub(t)
	roomID := "room-1"
	_, err := database.Exec(
		`INSERT INTO rooms (id, name, host_id, join_policy, max_peers, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		roomID, "Room", "host", "open", 50, time.Now().Unix(),
	)
	if err != nil {
		t.Fatalf("insert room: %v", err)
	}
	room := &Room{
		id:                 roomID,
		peers:              map[string]*Peer{},
		pending:            map[string]*Peer{},
		permissions:        map[string]models.PeerPermissions{},
		adminPermissions:   map[string]models.AdminPermissions{},
		bans:               map[string]int64{"ip:203.0.113.10": 0, "client:abc12345": 0},
		banGroups:          map[string]string{"ip:203.0.113.10": "ban-group-1", "client:abc12345": "ban-group-1"},
		banLabels:          map[string]string{"ip:203.0.113.10": "Alice", "client:abc12345": "Alice"},
		defaultPermissions: defaultPeerPermissions(),
	}
	host := &Peer{id: "host", roomID: roomID, isHost: true, send: make(chan []byte, 4), hub: hub}
	room.peers[host.id] = host
	hub.rooms[roomID] = room
	for identity := range room.bans {
		hub.persistBan(roomID, identity, 0, "Alice", "ban-group-1")
	}

	hub.handleMessage(host, []byte(`{"type":"unban-peer","payload":{"ban_id":"ban-group-1"}}`))

	if len(room.bans) != 0 {
		t.Fatalf("expected bans to be removed, got %#v", room.bans)
	}
	var count int
	if err := database.QueryRow(`SELECT COUNT(*) FROM room_bans WHERE room_id = ?`, roomID).Scan(&count); err != nil {
		t.Fatalf("count bans: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected persisted bans to be removed, got %d", count)
	}
	select {
	case raw := <-host.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode signal: %v", err)
		}
		if msg.Type != "ban-list" {
			t.Fatalf("expected ban-list, got %q", msg.Type)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for ban-list")
	}
}

func TestHandleUnbanPeerRequiresAdminBanPermission(t *testing.T) {
	hub, database := testHub(t)
	roomID := "room-1"
	_, err := database.Exec(
		`INSERT INTO rooms (id, name, host_id, join_policy, max_peers, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		roomID, "Room", "host", "open", 50, time.Now().Unix(),
	)
	if err != nil {
		t.Fatalf("insert room: %v", err)
	}
	room := &Room{
		id:                 roomID,
		peers:              map[string]*Peer{},
		pending:            map[string]*Peer{},
		permissions:        map[string]models.PeerPermissions{},
		adminPermissions:   map[string]models.AdminPermissions{},
		bans:               map[string]int64{"ip:203.0.113.10": 0},
		banGroups:          map[string]string{"ip:203.0.113.10": "ban-group-1"},
		banLabels:          map[string]string{"ip:203.0.113.10": "Alice"},
		defaultPermissions: defaultPeerPermissions(),
	}
	admin := &Peer{id: "admin", roomID: roomID, isAdmin: true, send: make(chan []byte, 4), hub: hub}
	room.peers[admin.id] = admin
	hub.rooms[roomID] = room
	hub.persistBan(roomID, "ip:203.0.113.10", 0, "Alice", "ban-group-1")

	hub.handleMessage(admin, []byte(`{"type":"unban-peer","payload":{"ban_id":"ban-group-1"}}`))

	if len(room.bans) != 1 {
		t.Fatalf("expected unauthorized admin ban removal to be blocked")
	}
	select {
	case raw := <-admin.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode signal: %v", err)
		}
		if msg.Type != "error" {
			t.Fatalf("expected permission error, got %q", msg.Type)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for permission error")
	}

	admin.adminPerms = models.AdminPermissions{CanManageBans: true}
	hub.handleMessage(admin, []byte(`{"type":"unban-peer","payload":{"ban_id":"ban-group-1"}}`))

	if len(room.bans) != 0 {
		t.Fatalf("expected authorized admin to remove bans, got %#v", room.bans)
	}
	select {
	case raw := <-admin.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode signal: %v", err)
		}
		if msg.Type != "ban-list" {
			t.Fatalf("expected ban-list, got %q", msg.Type)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for ban-list")
	}
}

func TestAdminCannotModerateHostOrOtherAdmins(t *testing.T) {
	hub, database := testHub(t)
	roomID := "room-1"
	_, err := database.Exec(
		`INSERT INTO rooms (id, name, host_id, join_policy, max_peers, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		roomID, "Room", "host", "open", 50, time.Now().Unix(),
	)
	if err != nil {
		t.Fatalf("insert room: %v", err)
	}
	room := &Room{
		id:                 roomID,
		peers:              map[string]*Peer{},
		pending:            map[string]*Peer{},
		permissions:        map[string]models.PeerPermissions{},
		adminPermissions:   map[string]models.AdminPermissions{},
		bans:               map[string]int64{},
		defaultPermissions: defaultPeerPermissions(),
	}
	admin := &Peer{
		id:          "admin-1",
		roomID:      roomID,
		isAdmin:     true,
		permissions: defaultPeerPermissions(),
		adminPerms: models.AdminPermissions{
			CanKick:          true,
			CanMuteMic:       true,
			CanDisableCamera: true,
			CanDisableScreen: true,
			CanDisableChat:   true,
			CanDisableEmoji:  true,
		},
		send: make(chan []byte, 4),
		hub:  hub,
	}
	host := &Peer{id: "host", roomID: roomID, isHost: true, permissions: defaultPeerPermissions(), send: make(chan []byte, 4), hub: hub}
	otherAdmin := &Peer{id: "admin-2", roomID: roomID, isAdmin: true, permissions: defaultPeerPermissions(), send: make(chan []byte, 4), hub: hub}
	room.peers[admin.id] = admin
	room.peers[host.id] = host
	room.peers[otherAdmin.id] = otherAdmin
	hub.rooms[roomID] = room

	hub.handleMessage(admin, []byte(`{"type":"kick-peer","payload":{"peer_id":"host","reason":"no"}}`))
	expectErrorMessage(t, admin, "admins cannot manage the host")

	hub.handleMessage(admin, []byte(`{"type":"set-peer-permissions","payload":{"peer_id":"admin-2","permissions":{"can_use_mic":false,"can_use_camera":true,"can_share_screen":true,"can_chat":true,"can_react":true}}}`))
	expectErrorMessage(t, admin, "admins cannot manage other admins")

	if _, ok := room.peers["host"]; !ok {
		t.Fatalf("host should not be removed")
	}
	if !otherAdmin.permissions.CanUseMic {
		t.Fatalf("other admin permissions should not be changed")
	}
}

func TestHandleMessageRespondsToPing(t *testing.T) {
	hub, _ := testHub(t)
	peer := &Peer{id: "peer-1", send: make(chan []byte, 4), hub: hub}

	hub.handleMessage(peer, []byte(`{"type":"ping","payload":{"id":"ping-1"}}`))

	select {
	case raw := <-peer.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode signal: %v", err)
		}
		if msg.Type != "pong" || msg.From != peer.id {
			t.Fatalf("unexpected signal: %#v", msg)
		}
		payload, ok := msg.Payload.(map[string]interface{})
		if !ok {
			t.Fatalf("unexpected payload type: %#v", msg.Payload)
		}
		if payload["id"] != "ping-1" {
			t.Fatalf("unexpected pong payload: %#v", payload)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for pong")
	}
}

func expectErrorMessage(t *testing.T, peer *Peer, expected string) {
	t.Helper()
	select {
	case raw := <-peer.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode signal: %v", err)
		}
		if msg.Type != "error" {
			t.Fatalf("expected error, got %q", msg.Type)
		}
		payload, ok := msg.Payload.(map[string]interface{})
		if !ok || payload["message"] != expected {
			t.Fatalf("expected error %q, got %#v", expected, msg.Payload)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for error %q", expected)
	}
}
