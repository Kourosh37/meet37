package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"meet-backend/internal/config"
	"meet-backend/internal/db"
	"meet-backend/internal/middleware"
	"meet-backend/internal/sfu"
	"meet-backend/internal/signaling"

	"github.com/gorilla/websocket"
)

func testConfig() *config.Config {
	return &config.Config{
		AdminUsername:         "admin",
		AdminPassword:         "admin-pass",
		JWTSecret:             "test-secret",
		DefaultAppMode:        "public",
		TURNPublicIP:          "127.0.0.1",
		TURNPort:              3478,
		TURNSecret:            "turn-secret",
		AccessTokenTTLMinutes: 15,
		RefreshTokenTTLDays:   30,
	}
}

func TestPrivateModeRoomCreationRequiresAuthenticatedCreator(t *testing.T) {
	cfg := testConfig()
	cfg.DefaultAppMode = "private"
	database, err := db.Open(t.TempDir()+"/meet.db", "private")
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	hub := signaling.NewHub(cfg, database, sfu.NewManager(cfg), nil)
	handler := NewRoomHandler(cfg, database, hub)

	anonymousRecorder := httptest.NewRecorder()
	handler.CreateRoom(
		anonymousRecorder,
		httptest.NewRequest(http.MethodPost, "/api/rooms", bytes.NewBufferString(`{"name":"Private room"}`)),
	)
	if anonymousRecorder.Code != http.StatusForbidden {
		t.Fatalf("anonymous create status = %d body=%s", anonymousRecorder.Code, anonymousRecorder.Body.String())
	}

	authenticatedRequest := httptest.NewRequest(http.MethodPost, "/api/rooms", bytes.NewBufferString(`{"name":"Private room","join_policy":"approval","max_peers":3}`))
	authenticatedRequest = authenticatedRequest.WithContext(context.WithValue(authenticatedRequest.Context(), middleware.CtxUserID, "user-1"))
	authenticatedRecorder := httptest.NewRecorder()
	handler.CreateRoom(authenticatedRecorder, authenticatedRequest)
	if authenticatedRecorder.Code != http.StatusCreated {
		t.Fatalf("authenticated create status = %d body=%s", authenticatedRecorder.Code, authenticatedRecorder.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(authenticatedRecorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if response["host_token"] == "" {
		t.Fatalf("expected host token in private room response")
	}
	room := response["room"].(map[string]interface{})
	if room["join_policy"] != "approval" || room["host_id"] != "user-1" {
		t.Fatalf("unexpected room response: %#v", room)
	}
}

func TestRoomCreationValidatesInputsAndCapsMaxPeers(t *testing.T) {
	cfg := testConfig()
	database := testDatabase(t)
	hub := signaling.NewHub(cfg, database, sfu.NewManager(cfg), nil)
	handler := NewRoomHandler(cfg, database, hub)

	badPolicyRecorder := httptest.NewRecorder()
	handler.CreateRoom(
		badPolicyRecorder,
		httptest.NewRequest(http.MethodPost, "/api/rooms", bytes.NewBufferString(`{"name":"Room","join_policy":"bad"}`)),
	)
	if badPolicyRecorder.Code != http.StatusBadRequest {
		t.Fatalf("bad join policy status = %d", badPolicyRecorder.Code)
	}

	cappedRecorder := httptest.NewRecorder()
	handler.CreateRoom(
		cappedRecorder,
		httptest.NewRequest(http.MethodPost, "/api/rooms", bytes.NewBufferString(`{"name":"Room","max_peers":999}`)),
	)
	if cappedRecorder.Code != http.StatusCreated {
		t.Fatalf("capped create status = %d body=%s", cappedRecorder.Code, cappedRecorder.Body.String())
	}
	var response map[string]interface{}
	if err := json.Unmarshal(cappedRecorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode capped response: %v", err)
	}
	room := response["room"].(map[string]interface{})
	if room["max_peers"].(float64) != 50 {
		t.Fatalf("expected max_peers fallback to 50, got %#v", room["max_peers"])
	}
	if !regexp.MustCompile(`^[a-z]{3}-[a-z]{3}-[a-z]{3}$`).MatchString(room["id"].(string)) {
		t.Fatalf("expected meet-style room id, got %#v", room["id"])
	}
}

func TestRoomCreationCanReuseExpiredRequestedRoomID(t *testing.T) {
	cfg := testConfig()
	database := testDatabase(t)
	hub := signaling.NewHub(cfg, database, sfu.NewManager(cfg), nil)
	handler := NewRoomHandler(cfg, database, hub)
	now := time.Now().Unix()
	roomID := "abc-def-ghi"

	_, err := database.Exec(
		`INSERT INTO rooms (id, name, host_id, join_policy, max_peers, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		roomID, "Expired", "old-host", "open", 50, now-7200, now-3600,
	)
	if err != nil {
		t.Fatalf("insert expired room: %v", err)
	}

	reuseRecorder := httptest.NewRecorder()
	handler.CreateRoom(
		reuseRecorder,
		httptest.NewRequest(http.MethodPost, "/api/rooms", bytes.NewBufferString(`{"name":"Reused","room_id":"abc-def-ghi","max_peers":25}`)),
	)
	if reuseRecorder.Code != http.StatusCreated {
		t.Fatalf("reuse create status = %d body=%s", reuseRecorder.Code, reuseRecorder.Body.String())
	}
	var response map[string]interface{}
	if err := json.Unmarshal(reuseRecorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode reuse response: %v", err)
	}
	room := response["room"].(map[string]interface{})
	if room["id"] != roomID || room["name"] != "Reused" {
		t.Fatalf("unexpected reused room response: %#v", room)
	}

	conflictRecorder := httptest.NewRecorder()
	handler.CreateRoom(
		conflictRecorder,
		httptest.NewRequest(http.MethodPost, "/api/rooms", bytes.NewBufferString(`{"name":"Conflict","room_id":"abc-def-ghi"}`)),
	)
	if conflictRecorder.Code != http.StatusConflict {
		t.Fatalf("active room reuse status = %d body=%s", conflictRecorder.Code, conflictRecorder.Body.String())
	}
}

func TestGetRoomHidesExpiredRooms(t *testing.T) {
	cfg := testConfig()
	database := testDatabase(t)
	hub := signaling.NewHub(cfg, database, sfu.NewManager(cfg), nil)
	handler := NewRoomHandler(cfg, database, hub)
	now := time.Now().Unix()
	_, err := database.Exec(
		`INSERT INTO rooms (id, name, host_id, join_policy, max_peers, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		"old-rom-idz", "Expired", "host", "open", 50, now-7200, now-3600,
	)
	if err != nil {
		t.Fatalf("insert expired room: %v", err)
	}

	recorder := httptest.NewRecorder()
	handler.GetRoom(recorder, httptest.NewRequest(http.MethodGet, "/api/rooms/old-rom-idz", nil))
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expired room status = %d body=%s", recorder.Code, recorder.Body.String())
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
	_, _ = database.Exec(
		`INSERT INTO file_transfers (room_id, file_id, sender_peer_id, target_peer_id, name, size, mime, status, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		roomID, "file-2", "peer-1", "peer-3", "notes.txt", 123, "text/plain", "offered", now,
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
	if err := json.Unmarshal(filesRecorder.Body.Bytes(), &files); err != nil || len(files) != 2 || files[0]["file_id"] != "file-1" {
		t.Fatalf("unexpected file history: len=%d err=%v body=%s", len(files), err, filesRecorder.Body.String())
	}

	filteredFilesRecorder := httptest.NewRecorder()
	handler.GetFileHistory(filteredFilesRecorder, httptest.NewRequest(http.MethodGet, "/api/rooms/"+roomID+"/files?peer_id=peer-2", nil))
	if filteredFilesRecorder.Code != http.StatusOK {
		t.Fatalf("filtered file history status = %d body=%s", filteredFilesRecorder.Code, filteredFilesRecorder.Body.String())
	}
	var filteredFiles []map[string]interface{}
	if err := json.Unmarshal(filteredFilesRecorder.Body.Bytes(), &filteredFiles); err != nil || len(filteredFiles) != 1 || filteredFiles[0]["file_id"] != "file-1" {
		t.Fatalf("unexpected filtered file history: len=%d err=%v body=%s", len(filteredFiles), err, filteredFilesRecorder.Body.String())
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
