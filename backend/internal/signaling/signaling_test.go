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

func TestHandleMessageRejectsDirectPeerSignaling(t *testing.T) {
	hub, _ := testHub(t)
	peer := &Peer{id: "peer-1", roomID: "room-1", mode: "sfu", send: make(chan []byte, 4), hub: hub}

	hub.handleMessage(peer, []byte(`{"type":"offer","to":"peer-2","payload":{"sdp":"direct-offer"}}`))

	select {
	case raw := <-peer.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode signal: %v", err)
		}
		if msg.Type != "error" {
			t.Fatalf("expected direct signaling error, got %q", msg.Type)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for direct signaling error")
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
		t.Fatalf("sender should not receive own broadcast: %s", string(raw))
	default:
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
