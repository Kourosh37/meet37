package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"meet-backend/internal/config"
	"meet-backend/internal/db"
	"meet-backend/internal/sfu"
	"meet-backend/internal/signaling"

	"github.com/gorilla/websocket"
)

func testConfig() *config.Config {
	return &config.Config{
		AdminUsername:            "admin",
		AdminPassword:            "admin-pass",
		JWTSecret:                "test-secret",
		DefaultAppMode:           "public",
		TURNPublicIP:             "127.0.0.1",
		TURNPort:                 3478,
		TURNSecret:               "turn-secret",
		SFUFallbackThresholdKbps: 1500,
		AccessTokenTTLMinutes:    15,
		RefreshTokenTTLDays:      30,
	}
}

func testDatabase(t *testing.T) *db.DB {
	t.Helper()
	database, err := db.Open(t.TempDir()+"/meet.db", "public")
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	return database
}

func TestAuthRefreshRotatesRefreshSession(t *testing.T) {
	cfg := testConfig()
	database := testDatabase(t)
	handler := NewAuthHandler(cfg, database)

	loginBody := bytes.NewBufferString(`{"username":"admin","password":"admin-pass"}`)
	loginRecorder := httptest.NewRecorder()
	handler.Login(loginRecorder, httptest.NewRequest(http.MethodPost, "/api/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status = %d body=%s", loginRecorder.Code, loginRecorder.Body.String())
	}

	var loginResp map[string]interface{}
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &loginResp); err != nil {
		t.Fatalf("decode login: %v", err)
	}
	refreshToken, _ := loginResp["refresh_token"].(string)
	if refreshToken == "" {
		t.Fatalf("missing refresh token")
	}

	refreshRecorder := httptest.NewRecorder()
	handler.Refresh(refreshRecorder, httptest.NewRequest(http.MethodPost, "/api/auth/refresh", bytes.NewBufferString(`{"refresh_token":"`+refreshToken+`"}`)))
	if refreshRecorder.Code != http.StatusOK {
		t.Fatalf("refresh status = %d body=%s", refreshRecorder.Code, refreshRecorder.Body.String())
	}

	replayRecorder := httptest.NewRecorder()
	handler.Refresh(replayRecorder, httptest.NewRequest(http.MethodPost, "/api/auth/refresh", bytes.NewBufferString(`{"refresh_token":"`+refreshToken+`"}`)))
	if replayRecorder.Code != http.StatusUnauthorized {
		t.Fatalf("replayed refresh status = %d", replayRecorder.Code)
	}
}

func TestRoomHistoryEndpointsReturnPersistedMessages(t *testing.T) {
	cfg := testConfig()
	database := testDatabase(t)
	hub := signaling.NewHub(cfg, database, sfu.NewManager(cfg), nil)
	handler := NewRoomHandler(cfg, database, hub)
	now := time.Now().Unix()
	roomID := "room-history"
	_, err := database.Exec(
		`INSERT INTO rooms (id, name, host_id, join_policy, max_peers, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		roomID, "History", "host", "open", 50, now,
	)
	if err != nil {
		t.Fatalf("insert room: %v", err)
	}
	_, _ = database.Exec(
		`INSERT INTO chat_messages (room_id, peer_id, user_id, display_name, text, ts) VALUES (?, ?, ?, ?, ?, ?)`,
		roomID, "peer-1", "user-1", "Alice", "hello", now,
	)
	_, _ = database.Exec(
		`INSERT INTO file_transfers (room_id, file_id, sender_peer_id, target_peer_id, name, size, mime, status, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		roomID, "file-1", "peer-1", "peer-2", "notes.txt", 123, "text/plain", "offered", now,
	)

	chatRecorder := httptest.NewRecorder()
	handler.GetChatHistory(chatRecorder, httptest.NewRequest(http.MethodGet, "/api/rooms/"+roomID+"/chat", nil))
	if chatRecorder.Code != http.StatusOK {
		t.Fatalf("chat history status = %d body=%s", chatRecorder.Code, chatRecorder.Body.String())
	}
	var chat []map[string]interface{}
	if err := json.Unmarshal(chatRecorder.Body.Bytes(), &chat); err != nil || len(chat) != 1 || chat[0]["text"] != "hello" {
		t.Fatalf("unexpected chat history: len=%d err=%v body=%s", len(chat), err, chatRecorder.Body.String())
	}

	filesRecorder := httptest.NewRecorder()
	handler.GetFileHistory(filesRecorder, httptest.NewRequest(http.MethodGet, "/api/rooms/"+roomID+"/files", nil))
	if filesRecorder.Code != http.StatusOK {
		t.Fatalf("file history status = %d body=%s", filesRecorder.Code, filesRecorder.Body.String())
	}
	var files []map[string]interface{}
	if err := json.Unmarshal(filesRecorder.Body.Bytes(), &files); err != nil || len(files) != 1 || files[0]["file_id"] != "file-1" {
		t.Fatalf("unexpected file history: len=%d err=%v body=%s", len(files), err, filesRecorder.Body.String())
	}
}

func TestAdminSFUStatsEndpoint(t *testing.T) {
	cfg := testConfig()
	database := testDatabase(t)
	manager := sfu.NewManager(cfg)
	hub := signaling.NewHub(cfg, database, manager, nil)
	handler := NewAdminHandler(database, hub)
	manager.CreateSession("room-1")

	recorder := httptest.NewRecorder()
	handler.GetSFUStats(recorder, httptest.NewRequest(http.MethodGet, "/api/admin/sfu/stats", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body["session_count"].(float64) != 1 {
		t.Fatalf("expected one SFU session, got %v", body["session_count"])
	}
}

func TestWebSocketJoinAndChatPersistence(t *testing.T) {
	cfg := testConfig()
	database := testDatabase(t)
	hub := signaling.NewHub(cfg, database, sfu.NewManager(cfg), nil)
	wsHandler := NewWSHandler(hub)
	roomID := "ws-room"
	_, err := database.Exec(
		`INSERT INTO rooms (id, name, host_id, join_policy, max_peers, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		roomID, "WebSocket", "host", "open", 50, time.Now().Unix(),
	)
	if err != nil {
		t.Fatalf("insert room: %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(wsHandler.ServeWS))
	defer server.Close()
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	first := dialWS(t, wsURL)
	defer first.Close()
	second := dialWS(t, wsURL)
	defer second.Close()

	writeWS(t, first, map[string]interface{}{"type": "join", "payload": map[string]interface{}{"room_id": roomID, "display_name": "Alice"}})
	expectSignalType(t, first, "joined")
	writeWS(t, second, map[string]interface{}{"type": "join", "payload": map[string]interface{}{"room_id": roomID, "display_name": "Bob"}})
	expectSignalType(t, second, "joined")

	writeWS(t, first, map[string]interface{}{"type": "chat", "payload": map[string]interface{}{"text": "hello over ws"}})
	expectSignalType(t, second, "chat")

	var count int
	if err := database.QueryRow(`SELECT COUNT(*) FROM chat_messages WHERE room_id = ? AND text = ?`, roomID, "hello over ws").Scan(&count); err != nil {
		t.Fatalf("count chat: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one persisted chat message, got %d", count)
	}
}

func dialWS(t *testing.T, url string) *websocket.Conn {
	t.Helper()
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial websocket: %v", err)
	}
	return conn
}

func writeWS(t *testing.T, conn *websocket.Conn, msg interface{}) {
	t.Helper()
	if err := conn.WriteJSON(msg); err != nil {
		t.Fatalf("write websocket: %v", err)
	}
}

func expectSignalType(t *testing.T, conn *websocket.Conn, expected string) {
	t.Helper()
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	for {
		var msg map[string]interface{}
		if err := conn.ReadJSON(&msg); err != nil {
			t.Fatalf("read websocket signal %q: %v", expected, err)
		}
		if msg["type"] == expected {
			return
		}
	}
}
