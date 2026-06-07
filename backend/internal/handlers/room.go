package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"meet-backend/internal/config"
	"meet-backend/internal/db"
	"meet-backend/internal/middleware"
	"meet-backend/internal/models"
	"meet-backend/internal/signaling"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type RoomHandler struct {
	cfg *config.Config
	db  *db.DB
	hub *signaling.Hub
}

func NewRoomHandler(cfg *config.Config, database *db.DB, hub *signaling.Hub) *RoomHandler {
	return &RoomHandler{cfg: cfg, db: database, hub: hub}
}

func (h *RoomHandler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	if err := h.checkCreatePermission(r); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	var req struct {
		Name       string `json:"name"`
		Password   string `json:"password"`
		JoinPolicy string `json:"join_policy"`
		MaxPeers   int    `json:"max_peers"`
		ExpiresIn  int64  `json:"expires_in"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "room name required")
		return
	}
	if req.MaxPeers <= 0 || req.MaxPeers > 500 {
		req.MaxPeers = 50
	}
	if req.JoinPolicy == "" {
		req.JoinPolicy = "open"
	}
	if req.JoinPolicy != "open" && req.JoinPolicy != "approval" {
		writeError(w, http.StatusBadRequest, "join_policy must be open or approval")
		return
	}

	hostID, _ := r.Context().Value(middleware.CtxUserID).(string)
	if hostID == "" {
		hostID = "guest:" + uuid.NewString()
	}
	passHash := ""
	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		passHash = string(hash)
	}
	var expiresAt *int64
	if req.ExpiresIn > 0 {
		t := time.Now().Add(time.Duration(req.ExpiresIn) * time.Second).Unix()
		expiresAt = &t
	}

	hostSecret, err := randomSecret()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	hostSecretHash, err := bcrypt.GenerateFromPassword([]byte(hostSecret), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	roomID, err := h.generateUniqueRoomID()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	room := models.Room{ID: roomID, Name: req.Name, HostID: hostID, HasPass: passHash != "", JoinPolicy: req.JoinPolicy, MaxPeers: req.MaxPeers, CreatedAt: time.Now().Unix(), ExpiresAt: expiresAt}
	_, err = h.db.Exec(
		`INSERT INTO rooms (id, name, host_id, password, join_policy, host_secret_hash, max_peers, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		room.ID, room.Name, room.HostID, nullString(passHash), room.JoinPolicy, string(hostSecretHash), room.MaxPeers, room.CreatedAt, nullInt64(expiresAt),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	hostToken, err := h.signHostToken(room.ID, hostSecret)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"room": room, "host_token": hostToken})
}

func (h *RoomHandler) GetRoom(w http.ResponseWriter, r *http.Request) {
	roomID := strings.TrimPrefix(r.URL.Path, "/api/rooms/")
	room, err := h.loadRoom(roomID)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"room": room, "live": h.hub.GetRoomStats(roomID)})
}

func (h *RoomHandler) GetChatHistory(w http.ResponseWriter, r *http.Request) {
	roomID := roomIDFromNestedPath(r.URL.Path, "chat")
	if roomID == "" {
		writeError(w, http.StatusBadRequest, "bad path")
		return
	}
	if _, err := h.loadRoom(roomID); err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	rows, err := h.db.Query(
		`SELECT id, room_id, peer_id, user_id, display_name, text, ts
		 FROM chat_messages WHERE room_id = ? ORDER BY ts ASC, id ASC LIMIT 500`,
		roomID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()

	messages := make([]models.ChatMessage, 0)
	for rows.Next() {
		var message models.ChatMessage
		var userID sql.NullString
		if rows.Scan(&message.ID, &message.RoomID, &message.PeerID, &userID, &message.DisplayName, &message.Text, &message.Timestamp) == nil {
			if userID.Valid {
				message.UserID = userID.String
			}
			messages = append(messages, message)
		}
	}
	writeJSON(w, http.StatusOK, messages)
}

func (h *RoomHandler) GetFileHistory(w http.ResponseWriter, r *http.Request) {
	roomID := roomIDFromNestedPath(r.URL.Path, "files")
	if roomID == "" {
		writeError(w, http.StatusBadRequest, "bad path")
		return
	}
	if _, err := h.loadRoom(roomID); err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	peerID := strings.TrimSpace(r.URL.Query().Get("peer_id"))
	query := `SELECT id, room_id, file_id, sender_peer_id, target_peer_id, name, size, mime, status, reason, ts
		 FROM file_transfers WHERE room_id = ?`
	args := []interface{}{roomID}
	if peerID != "" {
		query += ` AND target_peer_id = ?`
		args = append(args, peerID)
	}
	query += ` ORDER BY ts ASC, id ASC LIMIT 500`
	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()

	transfers := make([]models.FileTransfer, 0)
	for rows.Next() {
		var transfer models.FileTransfer
		var targetPeerID, name, mime, reason sql.NullString
		var size sql.NullInt64
		if rows.Scan(&transfer.ID, &transfer.RoomID, &transfer.FileID, &transfer.SenderPeerID, &targetPeerID, &name, &size, &mime, &transfer.Status, &reason, &transfer.Timestamp) == nil {
			if targetPeerID.Valid {
				transfer.TargetPeerID = targetPeerID.String
			}
			if name.Valid {
				transfer.Name = name.String
			}
			if size.Valid {
				transfer.Size = size.Int64
			}
			if mime.Valid {
				transfer.MIME = mime.String
			}
			if reason.Valid {
				transfer.Reason = reason.String
			}
			transfers = append(transfers, transfer)
		}
	}
	writeJSON(w, http.StatusOK, transfers)
}

func (h *RoomHandler) ListRooms(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`SELECT id, name, host_id, is_locked, password, join_policy, max_peers, created_at, expires_at FROM rooms WHERE expires_at IS NULL OR expires_at > ? ORDER BY created_at DESC`, time.Now().Unix())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()

	rooms := make([]models.Room, 0)
	for rows.Next() {
		room, err := scanRoom(rows)
		if err == nil {
			rooms = append(rooms, room)
		}
	}
	writeJSON(w, http.StatusOK, rooms)
}

func (h *RoomHandler) DeleteRoom(w http.ResponseWriter, r *http.Request) {
	roomID := strings.TrimPrefix(r.URL.Path, "/api/rooms/")
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)
	isAdmin, _ := r.Context().Value(middleware.CtxIsAdmin).(bool)

	var hostID string
	err := h.db.QueryRow(`SELECT host_id FROM rooms WHERE id = ?`, roomID).Scan(&hostID)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if !isAdmin && hostID != userID {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	_, _ = h.db.Exec(`DELETE FROM rooms WHERE id = ?`, roomID)
	h.hub.CloseRoom(roomID)
	w.WriteHeader(http.StatusNoContent)
}

func (h *RoomHandler) checkCreatePermission(r *http.Request) error {
	var mode string
	_ = h.db.QueryRow(`SELECT app_mode FROM settings WHERE id = 1`).Scan(&mode)
	if mode == string(models.AppModePublic) {
		return nil
	}
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)
	if userID == "" {
		return errForbidden("login required to create rooms in private mode")
	}
	return nil
}

func (h *RoomHandler) loadRoom(id string) (models.Room, error) {
	row := h.db.QueryRow(`SELECT id, name, host_id, is_locked, password, join_policy, max_peers, created_at, expires_at FROM rooms WHERE id = ?`, id)
	return scanRoom(row)
}

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanRoom(row rowScanner) (models.Room, error) {
	var room models.Room
	var passHash sql.NullString
	var expiresAt sql.NullInt64
	err := row.Scan(&room.ID, &room.Name, &room.HostID, &room.IsLocked, &passHash, &room.JoinPolicy, &room.MaxPeers, &room.CreatedAt, &expiresAt)
	room.HasPass = passHash.Valid && passHash.String != ""
	if expiresAt.Valid {
		t := expiresAt.Int64
		room.ExpiresAt = &t
	}
	return room, err
}

func (h *RoomHandler) signHostToken(roomID, secret string) (string, error) {
	claims := jwt.MapClaims{
		"type":        "room_host",
		"room_id":     roomID,
		"host_secret": secret,
		"iat":         time.Now().Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(h.cfg.JWTSecret))
}

func (h *RoomHandler) generateUniqueRoomID() (string, error) {
	for attempts := 0; attempts < 20; attempts++ {
		id, err := randomMeetingID()
		if err != nil {
			return "", err
		}
		var exists int
		err = h.db.QueryRow(`SELECT 1 FROM rooms WHERE id = ?`, id).Scan(&exists)
		if err == sql.ErrNoRows {
			return id, nil
		}
		if err != nil {
			return "", err
		}
	}
	return "", sql.ErrNoRows
}

func randomMeetingID() (string, error) {
	buf := make([]byte, 9)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, 11)
	out[3] = '-'
	out[7] = '-'
	for source, target := 0, 0; source < len(buf); source++ {
		if target == 3 || target == 7 {
			target++
		}
		out[target] = byte('a' + int(buf[source])%26)
		target++
	}
	return string(out), nil
}

func randomSecret() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func nullString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nullInt64(v *int64) interface{} {
	if v == nil {
		return nil
	}
	return *v
}

func roomIDFromNestedPath(path, suffix string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) != 4 || parts[0] != "api" || parts[1] != "rooms" || parts[3] != suffix {
		return ""
	}
	return parts[2]
}
