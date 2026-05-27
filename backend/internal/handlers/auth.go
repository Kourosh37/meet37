package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"meet-backend/internal/config"
	"meet-backend/internal/db"
	"meet-backend/internal/middleware"
	"meet-backend/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	cfg *config.Config
	db  *db.DB
}

func NewAuthHandler(cfg *config.Config, database *db.DB) *AuthHandler {
	return &AuthHandler{cfg: cfg, db: database}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	req.Username = strings.TrimSpace(req.Username)

	if req.Username == h.cfg.AdminUsername && req.Password == h.cfg.AdminPassword {
		h.writeToken(w, "admin", req.Username, true)
		return
	}

	var id, username, hash string
	err := h.db.QueryRow(`SELECT id, username, password FROM users WHERE username = ?`, req.Username).Scan(&id, &username, &hash)
	if err == sql.ErrNoRows || bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	h.writeToken(w, id, username, false)
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := h.checkRegisterPermission(r); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
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

func (h *AuthHandler) writeToken(w http.ResponseWriter, userID, username string, isAdmin bool) {
	claims := middleware.Claims{
		UserID:   userID,
		Username: username,
		IsAdmin:  isAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(h.cfg.JWTSecret))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"token": signed, "user_id": userID, "username": username, "is_admin": isAdmin})
}

func (h *AuthHandler) checkRegisterPermission(r *http.Request) error {
	var mode string
	_ = h.db.QueryRow(`SELECT app_mode FROM settings WHERE id = 1`).Scan(&mode)
	if mode == string(models.AppModePublic) {
		return nil
	}
	if !h.requestIsAdmin(r) {
		return errForbidden("only admin can register users in private mode")
	}
	return nil
}

func (h *AuthHandler) requestIsAdmin(r *http.Request) bool {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		return false
	}
	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(strings.TrimSpace(auth[7:]), claims, func(*jwt.Token) (interface{}, error) {
		return []byte(h.cfg.JWTSecret), nil
	})
	return err == nil && token.Valid && claims.IsAdmin
}

type errForbidden string

func (e errForbidden) Error() string { return string(e) }
