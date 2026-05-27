package sfu

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"sync"
	"time"

	"meet-backend/internal/config"

	"github.com/google/uuid"
)

type Session struct {
	ID        string `json:"id"`
	RoomID    string `json:"room_id"`
	CreatedAt int64  `json:"created_at"`
}

type Manager struct {
	cfg      *config.Config
	mu       sync.RWMutex
	sessions map[string]*Session
}

func NewManager(cfg *config.Config) *Manager {
	return &Manager{cfg: cfg, sessions: make(map[string]*Session)}
}

func (m *Manager) CreateSession(roomID string) *Session {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s := m.sessions[roomID]; s != nil {
		return s
	}
	s := &Session{ID: uuid.NewString(), RoomID: roomID, CreatedAt: time.Now().Unix()}
	m.sessions[roomID] = s
	return s
}

func (m *Manager) DeleteSession(roomID string) {
	m.mu.Lock()
	delete(m.sessions, roomID)
	m.mu.Unlock()
}

func (m *Manager) GetTURNCredentials(peerID string) []map[string]interface{} {
	expiry := time.Now().Add(6 * time.Hour).Unix()
	username := fmt.Sprintf("%d:%s", expiry, peerID)
	mac := hmac.New(sha1.New, []byte(m.cfg.TURNSecret))
	mac.Write([]byte(username))
	credential := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	return []map[string]interface{}{
		{
			"urls":       []string{fmt.Sprintf("turn:%s:%d?transport=udp", m.cfg.TURNPublicIP, m.cfg.TURNPort), fmt.Sprintf("turn:%s:%d?transport=tcp", m.cfg.TURNPublicIP, m.cfg.TURNPort)},
			"username":   username,
			"credential": credential,
		},
	}
}
