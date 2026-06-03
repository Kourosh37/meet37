package signaling

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"meet-backend/internal/cluster"
	"meet-backend/internal/config"
	"meet-backend/internal/db"
	"meet-backend/internal/middleware"
	"meet-backend/internal/models"
	"meet-backend/internal/sfu"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v4"
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

func (r *Room) displayNameTaken(displayName, exceptPeerID string) bool {
	name := strings.TrimSpace(displayName)
	for id, peer := range r.peers {
		if id != exceptPeerID && strings.EqualFold(strings.TrimSpace(peer.displayName), name) {
			return true
		}
	}
	for id, peer := range r.pending {
		if id != exceptPeerID && strings.EqualFold(strings.TrimSpace(peer.displayName), name) {
			return true
		}
	}
	return false
}

type Hub struct {
	rooms  map[string]*Room
	cfg    *config.Config
	db     *db.DB
	sfuMgr *sfu.Manager
	bus    cluster.Bus
	mu     sync.RWMutex
}

func NewHub(cfg *config.Config, database *db.DB, sfuMgr *sfu.Manager, bus cluster.Bus) *Hub {
	return &Hub{rooms: make(map[string]*Room), cfg: cfg, db: database, sfuMgr: sfuMgr, bus: bus}
}

func (h *Hub) StartCluster(ctx context.Context) {
	if h.bus != nil && h.bus.Enabled() {
		h.bus.Start(ctx, h.handleClusterMessage)
	}
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
	case "offer", "answer", "ice-candidate", "file-candidate":
		h.relay(p, msg)
	case "media-state", "audio-level":
		h.broadcast(p.roomID, msg, p.id)
	case "chat":
		h.broadcast(p.roomID, msg, p.id)
		h.persistChat(p, msg)
	case "file-offer":
		h.persistFileTransfer(p, msg, "offered")
		h.relay(p, msg)
	case "file-answer":
		h.persistFileTransfer(p, msg, "answered")
		h.relay(p, msg)
	case "stats":
		h.handleStats(p, msg)
	case "sfu-offer":
		h.handleSFUOffer(p, msg)
	case "sfu-ice-candidate":
		h.handleSFUIceCandidate(p, msg)
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

func (h *Hub) handleSFUOffer(p *Peer, msg models.SignalMessage) {
	if p.roomID == "" {
		p.sendMsg(errMsg("join a room before using sfu"))
		return
	}
	var req struct {
		SDP string `json:"sdp"`
	}
	if !decodePayload(msg.Payload, &req) || req.SDP == "" {
		p.sendMsg(errMsg("invalid sfu offer payload"))
		return
	}
	p.mu.Lock()
	p.mode = "sfu"
	p.mu.Unlock()

	session := h.sfuMgr.CreateSession(p.roomID)
	answerSDP, err := h.sfuMgr.HandleOffer(
		p.roomID,
		p.id,
		req.SDP,
		func(candidate webrtc.ICECandidateInit) {
			p.sendMsg(models.SignalMessage{Type: "sfu-ice-candidate", Payload: candidate})
		},
		func(signalType string, payload map[string]interface{}) {
			p.sendMsg(models.SignalMessage{Type: signalType, Payload: payload})
		},
	)
	if err != nil {
		log.Warn().Err(err).Str("peer", p.id).Str("room", p.roomID).Msg("sfu offer failed")
		p.sendMsg(errMsg("sfu offer failed"))
		return
	}
	p.sendMsg(models.SignalMessage{
		Type: "sfu-answer",
		Payload: map[string]interface{}{
			"session_id": session.ID,
			"sdp":        answerSDP,
		},
	})
	h.broadcast(p.roomID, models.SignalMessage{Type: "peer-mode-changed", From: p.id, Payload: map[string]interface{}{"peer_id": p.id, "mode": "sfu"}}, p.id)
}

func (h *Hub) handleSFUIceCandidate(p *Peer, msg models.SignalMessage) {
	if p.roomID == "" {
		return
	}
	var candidate webrtc.ICECandidateInit
	if !decodePayload(msg.Payload, &candidate) {
		p.sendMsg(errMsg("invalid sfu ice candidate"))
		return
	}
	if err := h.sfuMgr.AddICECandidate(p.roomID, p.id, candidate); err != nil {
		p.sendMsg(errMsg("sfu ice candidate failed"))
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
	if room.displayNameTaken(req.DisplayName, p.id) {
		room.mu.Unlock()
		p.sendMsg(errMsg("That display name is already in this room. Choose another name."))
		return
	}
	if len(room.peers) >= maxPeers {
		room.mu.Unlock()
		p.sendMsg(errMsg("room is full"))
		return
	}
	if joinPolicy == "approval" && !p.isHost {
		room.pending[p.id] = p
		room.mu.Unlock()
		p.roomID = req.RoomID
		h.upsertClusterPending(p)
		p.sendMsg(models.SignalMessage{Type: "waiting-approval", Payload: map[string]interface{}{"your_id": p.id}})
		h.notifyHosts(req.RoomID, models.SignalMessage{Type: "join-request", From: p.id, Payload: map[string]interface{}{"peer_id": p.id, "display_name": p.displayName}})
		h.publishCluster(cluster.Message{Kind: "join-request", RoomID: req.RoomID, TargetPeerID: p.id, Signal: models.SignalMessage{Type: "join-request", From: p.id, Payload: map[string]interface{}{"peer_id": p.id, "display_name": p.displayName}}})
		return
	}
	room.peers[p.id] = p
	room.mu.Unlock()
	p.roomID = req.RoomID
	h.upsertClusterPeer(p)

	go h.logEvent(req.RoomID, p.userID, "join")
	p.sendMsg(models.SignalMessage{Type: "joined", Payload: map[string]interface{}{"your_id": p.id, "peers": h.getPeerList(req.RoomID, p.id), "mode": p.mode, "is_host": p.isHost, "turn_servers": h.sfuMgr.GetTURNCredentials(p.id)}})
	h.broadcast(req.RoomID, models.SignalMessage{Type: "peer-joined", From: p.id, Payload: map[string]interface{}{"peer_id": p.id, "display_name": p.displayName, "is_host": p.isHost}}, p.id)
	h.maybeTriggerRoomSFU(req.RoomID)
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
		if !h.publishCluster(cluster.Message{Kind: "approve-pending", RoomID: host.roomID, TargetPeerID: req.PeerID, Signal: msg}) {
			host.sendMsg(errMsg("peer not pending"))
		}
		return
	}
	delete(room.pending, req.PeerID)
	if room.displayNameTaken(peer.displayName, peer.id) {
		room.mu.Unlock()
		peer.sendMsg(errMsg("That display name is already in this room. Choose another name."))
		go func() {
			time.Sleep(250 * time.Millisecond)
			_ = peer.conn.Close()
		}()
		return
	}
	room.peers[peer.id] = peer
	room.mu.Unlock()
	h.removeClusterPending(host.roomID, peer.id)
	h.upsertClusterPeer(peer)

	go h.logEvent(host.roomID, peer.userID, "join")
	peer.sendMsg(models.SignalMessage{Type: "joined", Payload: map[string]interface{}{"your_id": peer.id, "peers": h.getPeerList(host.roomID, peer.id), "mode": peer.mode, "is_host": false, "turn_servers": h.sfuMgr.GetTURNCredentials(peer.id)}})
	h.broadcast(host.roomID, models.SignalMessage{Type: "peer-joined", From: peer.id, Payload: map[string]interface{}{"peer_id": peer.id, "display_name": peer.displayName, "is_host": false}}, peer.id)
	h.maybeTriggerRoomSFU(host.roomID)
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
	if target != nil && target.isHost {
		host.sendMsg(errMsg("peer not found"))
		return
	}
	if target == nil {
		if !h.publishCluster(cluster.Message{Kind: "kick-peer", RoomID: host.roomID, TargetPeerID: req.PeerID, Signal: models.SignalMessage{Type: "kicked", Payload: map[string]string{"reason": req.Reason}}}) {
			host.sendMsg(errMsg("peer not found"))
		}
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
	if target != nil && target.isHost {
		host.sendMsg(errMsg("peer not found"))
		return
	}
	if target == nil {
		if !h.publishCluster(cluster.Message{Kind: "mute-peer", RoomID: host.roomID, TargetPeerID: req.PeerID, Signal: models.SignalMessage{Type: "mute-request", From: host.id, Payload: map[string]string{"kind": req.Kind}}}) {
			host.sendMsg(errMsg("peer not found"))
		}
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
		h.removeClusterPending(host.roomID, peer.id)
		go func() {
			time.Sleep(250 * time.Millisecond)
			_ = peer.conn.Close()
		}()
		return
	}
	if !h.publishCluster(cluster.Message{Kind: eventType, RoomID: host.roomID, TargetPeerID: req.PeerID, Signal: models.SignalMessage{Type: eventType, Payload: map[string]string{"reason": req.Reason}}}) {
		host.sendMsg(errMsg("peer not pending"))
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

func (h *Hub) maybeTriggerRoomSFU(roomID string) {
	threshold := h.cfg.SFUAutoPeerThreshold
	if threshold <= 0 {
		return
	}

	h.mu.RLock()
	room := h.rooms[roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}

	room.mu.RLock()
	if len(room.peers) < threshold {
		room.mu.RUnlock()
		return
	}
	peers := make([]*Peer, 0, len(room.peers))
	for _, peer := range room.peers {
		peers = append(peers, peer)
	}
	room.mu.RUnlock()

	for _, peer := range peers {
		h.triggerSFUFallback(peer)
	}
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
		return
	}
	h.publishCluster(cluster.Message{Kind: "relay", RoomID: from.roomID, TargetPeerID: msg.To, Signal: msg})
}

func (h *Hub) publishCluster(msg cluster.Message) bool {
	if h.bus == nil || !h.bus.Enabled() {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return h.bus.Publish(ctx, msg) == nil
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
	h.publishCluster(cluster.Message{Kind: "broadcast", RoomID: roomID, ExceptPeerID: exceptPeerID, Signal: msg})
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
		h.removeClusterPeer(p.roomID, p.id)
		h.removeClusterPending(p.roomID, p.id)

		h.broadcast(p.roomID, models.SignalMessage{Type: "peer-left", From: p.id, Payload: map[string]interface{}{"peer_id": p.id}}, p.id)
		go h.logEvent(p.roomID, p.userID, "leave")
		h.sfuMgr.RemovePeer(p.roomID, p.id)
		if empty {
			h.CloseRoom(p.roomID)
		}
		close(p.send)
	})
}

func (h *Hub) CloseRoom(roomID string) {
	h.closeRoom(roomID, true)
}

func (h *Hub) closeRoom(roomID string, publish bool) {
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
	h.removeClusterRoom(roomID)
	if publish {
		h.publishCluster(cluster.Message{Kind: "room-closed", RoomID: roomID, Signal: models.SignalMessage{Type: "room-closed"}})
	}
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

func (h *Hub) GetSFUStats() sfu.Stats {
	return h.sfuMgr.Stats()
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
	if h.bus != nil && h.bus.Enabled() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		records, err := h.bus.ListPeers(ctx, roomID)
		if err == nil {
			seen := map[string]bool{exceptID: true}
			for _, peer := range peers {
				seen[peer.ID] = true
			}
			for _, record := range records {
				if !seen[record.ID] {
					peers = append(peers, models.PeerInfo{ID: record.ID, UserID: record.UserID, DisplayName: record.DisplayName, Mode: record.Mode, IsHost: record.IsHost})
				}
			}
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

func (h *Hub) upsertClusterPeer(p *Peer) {
	if h.bus == nil || !h.bus.Enabled() || p.roomID == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = h.bus.UpsertPeer(ctx, p.roomID, cluster.PeerRecord{
		ID:          p.id,
		UserID:      p.userID,
		DisplayName: p.displayName,
		Mode:        p.mode,
		IsHost:      p.isHost,
	})
}

func (h *Hub) removeClusterPeer(roomID, peerID string) {
	if h.bus == nil || !h.bus.Enabled() || roomID == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = h.bus.RemovePeer(ctx, roomID, peerID)
}

func (h *Hub) handleClusterMessage(event cluster.Message) {
	switch event.Kind {
	case "relay":
		h.deliverClusterRelay(event)
	case "broadcast":
		h.deliverClusterBroadcast(event)
	case "room-closed":
		h.closeRoom(event.RoomID, false)
	case "join-request":
		h.notifyHosts(event.RoomID, event.Signal)
	case "approve-pending":
		h.approvePendingPeer(event.RoomID, event.TargetPeerID)
	case "join-rejected":
		h.closePendingPeer(event.RoomID, event.TargetPeerID, event.Signal)
	case "kick-peer", "mute-peer":
		h.deliverClusterRelay(event)
	}
}

func (h *Hub) deliverClusterRelay(event cluster.Message) {
	h.mu.RLock()
	room := h.rooms[event.RoomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	room.mu.RLock()
	target := room.peers[event.TargetPeerID]
	room.mu.RUnlock()
	if target != nil {
		target.sendMsg(event.Signal)
	}
}

func (h *Hub) deliverClusterBroadcast(event cluster.Message) {
	h.mu.RLock()
	room := h.rooms[event.RoomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	room.mu.RLock()
	defer room.mu.RUnlock()
	for id, peer := range room.peers {
		if id != event.ExceptPeerID {
			peer.sendMsg(event.Signal)
		}
	}
}

func (h *Hub) removeClusterRoom(roomID string) {
	if h.bus == nil || !h.bus.Enabled() || roomID == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = h.bus.RemoveRoom(ctx, roomID)
}

func (h *Hub) upsertClusterPending(p *Peer) {

	if h.bus == nil || !h.bus.Enabled() || p.roomID == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = h.bus.UpsertPending(ctx, p.roomID, cluster.PendingRecord{
		ID:          p.id,
		UserID:      p.userID,
		DisplayName: p.displayName,
	})
}

func (h *Hub) removeClusterPending(roomID, peerID string) {
	if h.bus == nil || !h.bus.Enabled() || roomID == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = h.bus.RemovePending(ctx, roomID, peerID)
}

func (h *Hub) approvePendingPeer(roomID, peerID string) {

	h.mu.RLock()
	room := h.rooms[roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	room.mu.Lock()
	peer := room.pending[peerID]
	if peer == nil {
		room.mu.Unlock()
		return
	}
	delete(room.pending, peerID)
	if room.displayNameTaken(peer.displayName, peer.id) {
		room.mu.Unlock()
		peer.sendMsg(errMsg("That display name is already in this room. Choose another name."))
		go func() {
			time.Sleep(250 * time.Millisecond)
			_ = peer.conn.Close()
		}()
		return
	}
	room.peers[peerID] = peer
	room.mu.Unlock()
	h.removeClusterPending(roomID, peerID)
	h.upsertClusterPeer(peer)
	go h.logEvent(roomID, peer.userID, "join")
	peer.sendMsg(models.SignalMessage{Type: "joined", Payload: map[string]interface{}{"your_id": peer.id, "peers": h.getPeerList(roomID, peer.id), "mode": peer.mode, "is_host": false, "turn_servers": h.sfuMgr.GetTURNCredentials(peer.id)}})
	h.broadcast(roomID, models.SignalMessage{Type: "peer-joined", From: peer.id, Payload: map[string]interface{}{"peer_id": peer.id, "display_name": peer.displayName, "is_host": false}}, peer.id)
}

func (h *Hub) closePendingPeer(roomID, peerID string, signal models.SignalMessage) {
	h.mu.RLock()
	room := h.rooms[roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	room.mu.Lock()
	peer := room.pending[peerID]
	delete(room.pending, peerID)
	room.mu.Unlock()
	if peer == nil {
		return
	}
	h.removeClusterPending(roomID, peerID)
	peer.sendMsg(signal)
	go func() {
		time.Sleep(250 * time.Millisecond)
		_ = peer.conn.Close()
	}()
}

func (h *Hub) persistChat(p *Peer, msg models.SignalMessage) {

	if p.roomID == "" {
		return
	}
	var body struct {
		Text string `json:"text"`
	}
	if !decodePayload(msg.Payload, &body) || strings.TrimSpace(body.Text) == "" {
		return
	}
	_, _ = h.db.Exec(
		`INSERT INTO chat_messages (room_id, peer_id, user_id, display_name, text, ts) VALUES (?, ?, ?, ?, ?, ?)`,
		p.roomID, p.id, p.userID, p.displayName, body.Text, time.Now().Unix(),
	)
}

func (h *Hub) persistFileTransfer(p *Peer, msg models.SignalMessage, status string) {

	if p.roomID == "" {
		return
	}
	var body struct {
		FileID   string `json:"file_id"`
		Name     string `json:"name"`
		Size     int64  `json:"size"`
		MIME     string `json:"mime"`
		Accepted *bool  `json:"accepted"`
		Reason   string `json:"reason"`
	}
	if !decodePayload(msg.Payload, &body) {
		return
	}
	if status == "answered" && body.Accepted != nil && !*body.Accepted {
		status = "rejected"
	}
	if body.FileID == "" {
		body.FileID = uuid.NewString()
	}
	_, _ = h.db.Exec(
		`INSERT INTO file_transfers (room_id, file_id, sender_peer_id, target_peer_id, name, size, mime, status, reason, ts)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		p.roomID, body.FileID, p.id, msg.To, body.Name, body.Size, body.MIME, status, body.Reason, time.Now().Unix(),
	)
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
