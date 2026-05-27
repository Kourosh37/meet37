package signaling

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"meet-backend/internal/config"
	"meet-backend/internal/db"
	"meet-backend/internal/middleware"
	"meet-backend/internal/models"
	"meet-backend/internal/sfu"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 128 * 1024
	maxPacketLoss  = 8.0
	maxRTT         = 300.0
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(*http.Request) bool {
		return true
	},
}

type Peer struct {
	id          string
	userID      string
	displayName string
	roomID      string
	isHost      bool
	conn        *websocket.Conn
	send        chan []byte
	mode        string
	hub         *Hub
	mu          sync.Mutex
	closed      sync.Once
}

type Room struct {
	id         string
	peers      map[string]*Peer
	pending    map[string]*Peer
	sfuSession *sfu.Session
	mu         sync.RWMutex
}

type Hub struct {
	rooms  map[string]*Room
	cfg    *config.Config
	db     *db.DB
	sfuMgr *sfu.Manager
	mu     sync.RWMutex
}

func NewHub(cfg *config.Config, database *db.DB, sfuMgr *sfu.Manager) *Hub {
	return &Hub{rooms: make(map[string]*Room), cfg: cfg, db: database, sfuMgr: sfuMgr}
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Warn().Err(err).Msg("websocket upgrade failed")
		return
	}
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)
	username, _ := r.Context().Value(middleware.CtxUsername).(string)
	peer := &Peer{id: uuid.NewString(), userID: userID, displayName: username, conn: conn, send: make(chan []byte, 256), mode: "p2p", hub: h}
	go peer.writePump()
	go peer.readPump()
}

func (p *Peer) readPump() {
	defer func() {
		p.hub.removePeer(p)
		_ = p.conn.Close()
	}()
	p.conn.SetReadLimit(maxMessageSize)
	_ = p.conn.SetReadDeadline(time.Now().Add(pongWait))
	p.conn.SetPongHandler(func(string) error {
		return p.conn.SetReadDeadline(time.Now().Add(pongWait))
	})
	for {
		_, raw, err := p.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Warn().Err(err).Str("peer", p.id).Msg("websocket read failed")
			}
			return
		}
		p.hub.handleMessage(p, raw)
	}
}

func (p *Peer) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = p.conn.Close()
	}()
	for {
		select {
		case msg, ok := <-p.send:
			_ = p.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = p.conn.WriteMessage(websocket.CloseMessage, nil)
				return
			}
			if err := p.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = p.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := p.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (p *Peer) sendMsg(msg interface{}) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case p.send <- data:
	default:
		log.Warn().Str("peer", p.id).Msg("dropping websocket message for slow peer")
	}
}

func (h *Hub) handleMessage(p *Peer, raw []byte) {
	var msg models.SignalMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		p.sendMsg(errMsg("invalid message"))
		return
	}
	msg.From = p.id
	switch msg.Type {
	case "join":
		h.handleJoin(p, msg)
	case "leave":
		h.removePeer(p)
	case "offer", "answer", "ice-candidate", "file-offer", "file-answer", "file-candidate":
		h.relay(p, msg)
	case "chat":
		h.broadcast(p.roomID, msg, p.id)
	case "stats":
		h.handleStats(p, msg)
	case "approve-peer":
		h.handleApprovePeer(p, msg)
	case "reject-peer":
		h.handleRejectPeer(p, msg)
	case "kick-peer":
		h.handleKickPeer(p, msg)
	case "mute-peer":
		h.handleMutePeer(p, msg)
	default:
		p.sendMsg(errMsg("unknown message type"))
	}
}

func (h *Hub) handleJoin(p *Peer, msg models.SignalMessage) {
	var req models.JoinRequest
	if !decodePayload(msg.Payload, &req) || req.RoomID == "" {
		p.sendMsg(errMsg("invalid join payload"))
		return
	}
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	if req.DisplayName == "" {
		p.sendMsg(errMsg("display_name required"))
		return
	}
	p.displayName = req.DisplayName

	isHost := h.isRoomHost(req.RoomID, p.userID, req.HostToken)
	if isHost {
		p.isHost = true
	}

	var roomPass sql.NullString
	var joinPolicy string
	var locked bool
	var maxPeers int
	err := h.db.QueryRow(`SELECT password, is_locked, join_policy, max_peers FROM rooms WHERE id = ? AND (expires_at IS NULL OR expires_at > ?)`, req.RoomID, time.Now().Unix()).Scan(&roomPass, &locked, &joinPolicy, &maxPeers)
	if err != nil {
		p.sendMsg(errMsg("room not found or expired"))
		return
	}
	if locked {
		p.sendMsg(errMsg("room is locked"))
		return
	}
	if roomPass.Valid && roomPass.String != "" && bcrypt.CompareHashAndPassword([]byte(roomPass.String), []byte(req.Password)) != nil {
		p.sendMsg(errMsg("wrong room password"))
		return
	}

	room := h.getOrCreateRoom(req.RoomID)
	room.mu.Lock()
	if len(room.peers) >= maxPeers {
		room.mu.Unlock()
		p.sendMsg(errMsg("room is full"))
		return
	}
	if joinPolicy == "approval" && !p.isHost {
		room.pending[p.id] = p
		room.mu.Unlock()
		p.roomID = req.RoomID
		p.sendMsg(models.SignalMessage{Type: "waiting-approval", Payload: map[string]interface{}{"your_id": p.id}})
		h.notifyHosts(req.RoomID, models.SignalMessage{Type: "join-request", From: p.id, Payload: map[string]interface{}{"peer_id": p.id, "display_name": p.displayName}})
		return
	}
	room.peers[p.id] = p
	room.mu.Unlock()
	p.roomID = req.RoomID

	go h.logEvent(req.RoomID, p.userID, "join")
	p.sendMsg(models.SignalMessage{Type: "joined", Payload: map[string]interface{}{"your_id": p.id, "peers": h.getPeerList(req.RoomID, p.id), "mode": p.mode, "is_host": p.isHost}})
	h.broadcast(req.RoomID, models.SignalMessage{Type: "peer-joined", From: p.id, Payload: map[string]interface{}{"peer_id": p.id, "display_name": p.displayName, "is_host": p.isHost}}, p.id)
}

func (h *Hub) handleApprovePeer(host *Peer, msg models.SignalMessage) {
	if !host.isHost || host.roomID == "" {
		host.sendMsg(errMsg("host permission required"))
		return
	}
	var req struct {
		PeerID string `json:"peer_id"`
	}
	if !decodePayload(msg.Payload, &req) || req.PeerID == "" {
		host.sendMsg(errMsg("invalid approve payload"))
		return
	}
	h.mu.RLock()
	room := h.rooms[host.roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	room.mu.Lock()
	peer := room.pending[req.PeerID]
	if peer == nil {
		room.mu.Unlock()
		host.sendMsg(errMsg("peer not pending"))
		return
	}
	delete(room.pending, req.PeerID)
	room.peers[peer.id] = peer
	room.mu.Unlock()

	go h.logEvent(host.roomID, peer.userID, "join")
	peer.sendMsg(models.SignalMessage{Type: "joined", Payload: map[string]interface{}{"your_id": peer.id, "peers": h.getPeerList(host.roomID, peer.id), "mode": peer.mode, "is_host": false}})
	h.broadcast(host.roomID, models.SignalMessage{Type: "peer-joined", From: peer.id, Payload: map[string]interface{}{"peer_id": peer.id, "display_name": peer.displayName, "is_host": false}}, peer.id)
}

func (h *Hub) handleRejectPeer(host *Peer, msg models.SignalMessage) {
	h.closePendingByHost(host, msg, "join-rejected")
}

func (h *Hub) handleKickPeer(host *Peer, msg models.SignalMessage) {
	if !host.isHost || host.roomID == "" {
		host.sendMsg(errMsg("host permission required"))
		return
	}
	var req struct {
		PeerID string `json:"peer_id"`
		Reason string `json:"reason,omitempty"`
	}
	if !decodePayload(msg.Payload, &req) || req.PeerID == "" {
		host.sendMsg(errMsg("invalid kick payload"))
		return
	}
	h.mu.RLock()
	room := h.rooms[host.roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	room.mu.RLock()
	target := room.peers[req.PeerID]
	room.mu.RUnlock()
	if target == nil || target.isHost {
		host.sendMsg(errMsg("peer not found"))
		return
	}
	target.sendMsg(models.SignalMessage{Type: "kicked", Payload: map[string]string{"reason": req.Reason}})
	h.removePeer(target)
}

func (h *Hub) handleMutePeer(host *Peer, msg models.SignalMessage) {
	if !host.isHost || host.roomID == "" {
		host.sendMsg(errMsg("host permission required"))
		return
	}
	var req struct {
		PeerID string `json:"peer_id"`
		Kind   string `json:"kind"`
	}
	if !decodePayload(msg.Payload, &req) || req.PeerID == "" {
		host.sendMsg(errMsg("invalid mute payload"))
		return
	}
	if req.Kind == "" {
		req.Kind = "audio"
	}
	h.mu.RLock()
	room := h.rooms[host.roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	room.mu.RLock()
	target := room.peers[req.PeerID]
	room.mu.RUnlock()
	if target == nil || target.isHost {
		host.sendMsg(errMsg("peer not found"))
		return
	}
	target.sendMsg(models.SignalMessage{Type: "mute-request", From: host.id, Payload: map[string]string{"kind": req.Kind}})
}

func (h *Hub) closePendingByHost(host *Peer, msg models.SignalMessage, eventType string) {
	if !host.isHost || host.roomID == "" {
		host.sendMsg(errMsg("host permission required"))
		return
	}
	var req struct {
		PeerID string `json:"peer_id"`
		Reason string `json:"reason,omitempty"`
	}
	if !decodePayload(msg.Payload, &req) || req.PeerID == "" {
		host.sendMsg(errMsg("invalid payload"))
		return
	}
	h.mu.RLock()
	room := h.rooms[host.roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	room.mu.Lock()
	peer := room.pending[req.PeerID]
	delete(room.pending, req.PeerID)
	room.mu.Unlock()
	if peer != nil {
		peer.sendMsg(models.SignalMessage{Type: eventType, Payload: map[string]string{"reason": req.Reason}})
		go func() {
			time.Sleep(250 * time.Millisecond)
			_ = peer.conn.Close()
		}()
	}
}

func (h *Hub) handleStats(p *Peer, msg models.SignalMessage) {
	var stats models.StatsReport
	if !decodePayload(msg.Payload, &stats) {
		return
	}
	shouldFallback := stats.BitrateKbps > 0 && stats.BitrateKbps < float64(h.cfg.SFUFallbackThresholdKbps)
	shouldFallback = shouldFallback || stats.PacketLossPct > maxPacketLoss || stats.RTTMs > maxRTT
	if shouldFallback {
		h.triggerSFUFallback(p)
	}
}

func (h *Hub) triggerSFUFallback(p *Peer) {
	if p.roomID == "" {
		return
	}
	p.mu.Lock()
	if p.mode == "sfu" {
		p.mu.Unlock()
		return
	}
	p.mode = "sfu"
	p.mu.Unlock()

	room := h.getOrCreateRoom(p.roomID)
	room.mu.Lock()
	if room.sfuSession == nil {
		room.sfuSession = h.sfuMgr.CreateSession(p.roomID)
	}
	session := room.sfuSession
	room.mu.Unlock()

	p.sendMsg(models.SignalMessage{Type: "sfu-switch", Payload: map[string]interface{}{"session_id": session.ID, "turn_servers": h.sfuMgr.GetTURNCredentials(p.id)}})
	h.broadcast(p.roomID, models.SignalMessage{Type: "peer-mode-changed", From: p.id, Payload: map[string]interface{}{"peer_id": p.id, "mode": "sfu"}}, p.id)
}

func (h *Hub) relay(from *Peer, msg models.SignalMessage) {
	if from.roomID == "" || msg.To == "" {
		return
	}
	h.mu.RLock()
	room := h.rooms[from.roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	room.mu.RLock()
	target := room.peers[msg.To]
	room.mu.RUnlock()
	if target != nil {
		target.sendMsg(msg)
	}
}

func (h *Hub) broadcast(roomID string, msg models.SignalMessage, exceptPeerID string) {
	if roomID == "" {
		return
	}
	h.mu.RLock()
	room := h.rooms[roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	room.mu.RLock()
	defer room.mu.RUnlock()
	for id, peer := range room.peers {
		if id != exceptPeerID {
			peer.sendMsg(msg)
		}
	}
}

func (h *Hub) removePeer(p *Peer) {
	p.closed.Do(func() {
		if p.roomID == "" {
			close(p.send)
			return
		}
		h.mu.RLock()
		room := h.rooms[p.roomID]
		h.mu.RUnlock()
		if room == nil {
			close(p.send)
			return
		}
		room.mu.Lock()
		delete(room.peers, p.id)
		delete(room.pending, p.id)
		empty := len(room.peers) == 0 && len(room.pending) == 0
		room.mu.Unlock()

		h.broadcast(p.roomID, models.SignalMessage{Type: "peer-left", From: p.id, Payload: map[string]interface{}{"peer_id": p.id}}, p.id)
		go h.logEvent(p.roomID, p.userID, "leave")
		if empty {
			h.CloseRoom(p.roomID)
		}
		close(p.send)
	})
}

func (h *Hub) CloseRoom(roomID string) {
	h.mu.Lock()
	room := h.rooms[roomID]
	delete(h.rooms, roomID)
	h.mu.Unlock()
	if room == nil {
		return
	}
	room.mu.Lock()
	for _, peer := range room.peers {
		peer.sendMsg(models.SignalMessage{Type: "room-closed"})
		peer.roomID = ""
	}
	for _, peer := range room.pending {
		peer.sendMsg(models.SignalMessage{Type: "room-closed"})
		peer.roomID = ""
	}
	room.peers = map[string]*Peer{}
	room.pending = map[string]*Peer{}
	room.mu.Unlock()
	h.sfuMgr.DeleteSession(roomID)
}

func (h *Hub) GetRoomStats(roomID string) map[string]interface{} {
	h.mu.RLock()
	room := h.rooms[roomID]
	h.mu.RUnlock()
	if room == nil {
		return map[string]interface{}{"active": false}
	}
	room.mu.RLock()
	defer room.mu.RUnlock()
	p2p, sfuCount := 0, 0
	for _, peer := range room.peers {
		if peer.mode == "sfu" {
			sfuCount++
		} else {
			p2p++
		}
	}
	return map[string]interface{}{"active": true, "peer_count": len(room.peers), "pending_count": len(room.pending), "p2p_peers": p2p, "sfu_peers": sfuCount, "has_sfu_session": room.sfuSession != nil}
}

func (h *Hub) getOrCreateRoom(roomID string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	if room := h.rooms[roomID]; room != nil {
		return room
	}
	room := &Room{id: roomID, peers: make(map[string]*Peer), pending: make(map[string]*Peer)}
	h.rooms[roomID] = room
	return room
}

func (h *Hub) getPeerList(roomID, exceptID string) []models.PeerInfo {
	h.mu.RLock()
	room := h.rooms[roomID]
	h.mu.RUnlock()
	if room == nil {
		return nil
	}
	room.mu.RLock()
	defer room.mu.RUnlock()
	peers := make([]models.PeerInfo, 0, len(room.peers))
	for id, peer := range room.peers {
		if id != exceptID {
			peers = append(peers, models.PeerInfo{ID: peer.id, UserID: peer.userID, DisplayName: peer.displayName, Mode: peer.mode, IsHost: peer.isHost})
		}
	}
	return peers
}

func (h *Hub) notifyHosts(roomID string, msg models.SignalMessage) {
	h.mu.RLock()
	room := h.rooms[roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	room.mu.RLock()
	defer room.mu.RUnlock()
	for _, peer := range room.peers {
		if peer.isHost {
			peer.sendMsg(msg)
		}
	}
}

func (h *Hub) isRoomHost(roomID, userID, hostToken string) bool {
	var hostID string
	var secretHash sql.NullString
	if err := h.db.QueryRow(`SELECT host_id, host_secret_hash FROM rooms WHERE id = ?`, roomID).Scan(&hostID, &secretHash); err != nil {
		return false
	}
	if userID != "" && userID == hostID {
		return true
	}
	if hostToken == "" || !secretHash.Valid {
		return false
	}
	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(hostToken, claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, jwt.ErrTokenUnverifiable
		}
		return []byte(h.cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid || claims["type"] != "room_host" || claims["room_id"] != roomID {
		return false
	}
	secret, _ := claims["host_secret"].(string)
	return secret != "" && bcrypt.CompareHashAndPassword([]byte(secretHash.String), []byte(secret)) == nil
}

func (h *Hub) logEvent(roomID, userID, event string) {
	_, _ = h.db.Exec(`INSERT INTO room_events (room_id, user_id, event, ts) VALUES (?, ?, ?, ?)`, roomID, userID, event, time.Now().Unix())
}

func decodePayload(payload interface{}, out interface{}) bool {
	raw, err := json.Marshal(payload)
	if err != nil {
		return false
	}
	return json.Unmarshal(raw, out) == nil
}

func errMsg(msg string) models.SignalMessage {
	return models.SignalMessage{Type: "error", Payload: map[string]string{"message": msg}}
}
