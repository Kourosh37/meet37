package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
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
		h.writeTokenPair(w, "admin", req.Username, true)
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
	h.writeTokenPair(w, id, username, false)
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

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "refresh_token required")
		return
	}
	hash := hashToken(req.RefreshToken)
	now := time.Now().Unix()

	var sessionID, userID, username string
	var isAdmin bool
	err := h.db.QueryRow(
		`SELECT id, user_id, username, is_admin FROM refresh_sessions
		 WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
		hash, now,
	).Scan(&sessionID, &userID, &username, &isAdmin)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	_, _ = h.db.Exec(`UPDATE refresh_sessions SET revoked_at = ? WHERE id = ?`, now, sessionID)
	h.writeTokenPair(w, userID, username, isAdmin)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "refresh_token required")
		return
	}
	_, _ = h.db.Exec(`UPDATE refresh_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`, time.Now().Unix(), hashToken(req.RefreshToken))
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) writeTokenPair(w http.ResponseWriter, userID, username string, isAdmin bool) {
	accessToken, accessExpiresAt, err := h.signAccessToken(userID, username, isAdmin)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	refreshToken, refreshExpiresAt, err := h.createRefreshSession(userID, username, isAdmin)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token":              accessToken,
		"access_token":       accessToken,
		"refresh_token":      refreshToken,
		"token_type":         "Bearer",
		"expires_at":         accessExpiresAt.Unix(),
		"refresh_expires_at": refreshExpiresAt.Unix(),
		"user_id":            userID,
		"username":           username,
		"is_admin":           isAdmin,
	})
}

func (h *AuthHandler) signAccessToken(userID, username string, isAdmin bool) (string, time.Time, error) {
	expiresAt := time.Now().Add(time.Duration(h.cfg.AccessTokenTTLMinutes) * time.Minute)
	claims := middleware.Claims{
		UserID:   userID,
		Username: username,
		IsAdmin:  isAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(h.cfg.JWTSecret))
	return signed, expiresAt, err
}

func (h *AuthHandler) createRefreshSession(userID, username string, isAdmin bool) (string, time.Time, error) {
	token, err := randomToken(48)
	if err != nil {
		return "", time.Time{}, err
	}
	now := time.Now()
	expiresAt := now.Add(time.Duration(h.cfg.RefreshTokenTTLDays) * 24 * time.Hour)
	_, err = h.db.Exec(
		`INSERT INTO refresh_sessions (id, user_id, username, is_admin, token_hash, created_at, expires_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		uuid.NewString(), userID, username, isAdmin, hashToken(token), now.Unix(), expiresAt.Unix(),
	)
	return token, expiresAt, err
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
	token, err := jwt.ParseWithClaims(strings.TrimSpace(auth[7:]), claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, jwt.ErrTokenUnverifiable
		}
		return []byte(h.cfg.JWTSecret), nil
	})
	return err == nil && token.Valid && claims.IsAdmin
}

type errForbidden string

func (e errForbidden) Error() string { return string(e) }

func randomToken(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
