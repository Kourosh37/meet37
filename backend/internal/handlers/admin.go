package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"meet-backend/internal/db"
	"meet-backend/internal/models"
	"meet-backend/internal/signaling"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AdminHandler struct {
	db  *db.DB
	hub *signaling.Hub
}

func NewAdminHandler(database *db.DB, hub *signaling.Hub) *AdminHandler {
	return &AdminHandler{db: database, hub: hub}
}

func (h *AdminHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	var mode string
	_ = h.db.QueryRow(`SELECT app_mode FROM settings WHERE id = 1`).Scan(&mode)
	writeJSON(w, http.StatusOK, map[string]string{"app_mode": mode})
}

func (h *AdminHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AppMode models.AppMode `json:"app_mode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	if body.AppMode != models.AppModePublic && body.AppMode != models.AppModePrivate {
		writeError(w, http.StatusBadRequest, "invalid app_mode")
		return
	}
	_, _ = h.db.Exec(`UPDATE settings SET app_mode = ? WHERE id = 1`, body.AppMode)
	writeJSON(w, http.StatusOK, map[string]string{"app_mode": string(body.AppMode)})
}

func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`SELECT id, username, created_at FROM users ORDER BY created_at DESC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()

	users := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		if rows.Scan(&u.ID, &u.Username, &u.CreatedAt) == nil {
			users = append(users, u)
		}
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *AdminHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if len(req.Username) < 3 || len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "username or password too short")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	u := models.User{ID: uuid.NewString(), Username: req.Username, CreatedAt: time.Now().Unix()}
	if _, err := h.db.Exec(`INSERT INTO users (id, username, password, created_at) VALUES (?, ?, ?, ?)`, u.ID, u.Username, string(hash), u.CreatedAt); err != nil {
		writeError(w, http.StatusConflict, "username already exists")
		return
	}
	writeJSON(w, http.StatusCreated, u)
}

func (h *AdminHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	userID := strings.TrimPrefix(r.URL.Path, "/api/admin/users/")
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" && req.Password == "" {
		writeError(w, http.StatusBadRequest, "nothing to update")
		return
	}
	if req.Username != "" {
		if len(req.Username) < 3 {
			writeError(w, http.StatusBadRequest, "username too short")
			return
		}
		if _, err := h.db.Exec(`UPDATE users SET username = ? WHERE id = ?`, req.Username, userID); err != nil {
			writeError(w, http.StatusConflict, "username already exists")
			return
		}
	}
	if req.Password != "" {
		if len(req.Password) < 8 {
			writeError(w, http.StatusBadRequest, "password too short")
			return
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		_, _ = h.db.Exec(`UPDATE users SET password = ? WHERE id = ?`, string(hash), userID)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	userID := strings.TrimPrefix(r.URL.Path, "/api/admin/users/")
	if userID == "" {
		writeError(w, http.StatusBadRequest, "user id required")
		return
	}
	_, _ = h.db.Exec(`DELETE FROM users WHERE id = ?`, userID)
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminHandler) GetRoomStats(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) != 5 || parts[0] != "api" || parts[1] != "admin" || parts[2] != "rooms" || parts[4] != "stats" {
		writeError(w, http.StatusBadRequest, "bad path")
		return
	}
	writeJSON(w, http.StatusOK, h.hub.GetRoomStats(parts[3]))
}
