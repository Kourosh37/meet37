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
		JWTSecret:                "test-secret",
		TURNPublicIP:             "127.0.0.1",
		TURNPort:                 3478,
		TURNSecret:               "turn-secret",
		SFUFallbackThresholdKbps: 1500,
	}
	database, err := db.Open(t.TempDir()+"/meet.db", "public")
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	return NewHub(cfg, database, sfu.NewManager(cfg), nil), database
}

func TestHandleStatsTriggersSFUSwitch(t *testing.T) {
	hub, _ := testHub(t)
	peer := &Peer{id: "peer-1", roomID: "room-1", mode: "p2p", send: make(chan []byte, 4), hub: hub}

	hub.handleStats(peer, models.SignalMessage{Payload: map[string]interface{}{"bitrate_kbps": 100.0}})

	select {
	case raw := <-peer.send:
		var msg models.SignalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("decode signal: %v", err)
		}
		if msg.Type != "sfu-switch" {
			t.Fatalf("expected sfu-switch, got %q", msg.Type)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for sfu-switch")
	}
}

func TestRoomAutoSFUSwitchesAtPeerThreshold(t *testing.T) {
	hub, _ := testHub(t)
	hub.cfg.SFUAutoPeerThreshold = 2
	roomID := "room-1"
	first := &Peer{id: "peer-1", roomID: roomID, mode: "p2p", send: make(chan []byte, 4), hub: hub}
	second := &Peer{id: "peer-2", roomID: roomID, mode: "p2p", send: make(chan []byte, 4), hub: hub}
	hub.rooms[roomID] = &Room{
		id:      roomID,
		peers:   map[string]*Peer{first.id: first, second.id: second},
		pending: map[string]*Peer{},
	}

	hub.maybeTriggerRoomSFU(roomID)

	for _, peer := range []*Peer{first, second} {
		deadline := time.After(time.Second)
		for {
			select {
			case raw := <-peer.send:
				var msg models.SignalMessage
				if err := json.Unmarshal(raw, &msg); err != nil {
					t.Fatalf("decode signal: %v", err)
				}
				if msg.Type == "sfu-switch" {
					goto nextPeer
				}
			case <-deadline:
				t.Fatalf("timed out waiting for sfu-switch for %s", peer.id)
			}
		}
	nextPeer:
	}
}

func TestHandleMessagePersistsChatAndFileMetadata(t *testing.T) {
	hub, database := testHub(t)
	roomID := "room-1"
	peer := &Peer{id: "peer-1", roomID: roomID, displayName: "Alice", send: make(chan []byte, 4), hub: hub}
	_, err := database.Exec(
		`INSERT INTO rooms (id, name, host_id, join_policy, max_peers, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		roomID, "Room", "host", "open", 50, time.Now().Unix(),
	)
	if err != nil {
		t.Fatalf("insert room: %v", err)
	}
	hub.rooms[roomID] = &Room{id: roomID, peers: map[string]*Peer{peer.id: peer}, pending: map[string]*Peer{}}

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
	sender := &Peer{id: "peer-1", roomID: roomID, displayName: "Alice", send: make(chan []byte, 4), hub: hub}
	receiver := &Peer{id: "peer-2", roomID: roomID, displayName: "Bob", send: make(chan []byte, 4), hub: hub}
	hub.rooms[roomID] = &Room{
		id:      roomID,
		peers:   map[string]*Peer{sender.id: sender, receiver.id: receiver},
		pending: map[string]*Peer{},
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
