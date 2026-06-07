package signaling

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net"
	"net/http"
	"regexp"
	"sort"
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
	maxMessageSize = 256 * 1024
)

var clientIDPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{8,128}$`)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(*http.Request) bool {
		return true
	},
}

func defaultPeerPermissions() models.PeerPermissions {
	return models.PeerPermissions{
		CanUseMic:      true,
		CanUseCamera:   true,
		CanShareScreen: true,
		CanChat:        true,
		CanReact:       true,
	}
}

func intFromBool(value bool) int {
	if value {
		return 1
	}
	return 0
}

func boolFromInt(value int) bool {
	return value != 0
}

func identityKey(userID, displayName string) string {
	if userID != "" {
		return "user:" + userID
	}
	return "name:" + strings.ToLower(strings.TrimSpace(displayName))
}

func sanitizeClientID(value string) string {
	value = strings.TrimSpace(value)
	if !clientIDPattern.MatchString(value) {
		return ""
	}
	return value
}

func requestIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if idx := strings.IndexByte(xff, ','); idx >= 0 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		return strings.TrimSpace(xrip)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

func banIdentities(userID, displayName, clientID, remoteIP, userAgent string) []string {
	values := []string{identityKey(userID, displayName)}
	if clientID = sanitizeClientID(clientID); clientID != "" {
		values = append(values, "client:"+clientID)
	}
	remoteIP = strings.TrimSpace(remoteIP)
	if remoteIP != "" {
		values = append(values, "ip:"+remoteIP)
	}
	userAgent = strings.TrimSpace(userAgent)
	if remoteIP != "" && userAgent != "" {
		hash := sha256.Sum256([]byte(remoteIP + "\x00" + userAgent))
		values = append(values, "fingerprint:"+hex.EncodeToString(hash[:])[:32])
	}

	seen := make(map[string]bool, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	return out
}

func canKickPeer(peer *Peer) bool {
	return peer.isHost || (peer.isAdmin && peer.adminPerms.CanKick)
}

func canMuteMic(peer *Peer) bool {
	return peer.isHost || (peer.isAdmin && peer.adminPerms.CanMuteMic)
}

func canDisableCamera(peer *Peer) bool {
	return peer.isHost || (peer.isAdmin && peer.adminPerms.CanDisableCamera)
}

func canDisableScreen(peer *Peer) bool {
	return peer.isHost || (peer.isAdmin && peer.adminPerms.CanDisableScreen)
}

func canDisableChat(peer *Peer) bool {
	return peer.isHost || (peer.isAdmin && peer.adminPerms.CanDisableChat)
}

func canDisableEmoji(peer *Peer) bool {
	return peer.isHost || (peer.isAdmin && peer.adminPerms.CanDisableEmoji)
}

func canManageBans(peer *Peer) bool {
	return peer.isHost || (peer.isAdmin && peer.adminPerms.CanManageBans)
}

func protectedPeerError(actor, target *Peer) string {
	if actor.isHost || target == nil {
		return ""
	}
	if target.isHost {
		return "admins cannot manage the host"
	}
	if target.isAdmin {
		return "admins cannot manage other admins"
	}
	return ""
}

type Peer struct {
	id          string
	userID      string
	clientID    string
	displayName string
	remoteIP    string
	userAgent   string
	roomID      string
	isHost      bool
	isAdmin     bool
	permissions models.PeerPermissions
	adminPerms  models.AdminPermissions
	conn        *websocket.Conn
	send        chan []byte
	mode        string
	hub         *Hub
	mu          sync.Mutex
	closed      sync.Once
}

type Room struct {
	id                 string
	peers              map[string]*Peer
	pending            map[string]*Peer
	sfuSession         *sfu.Session
	permissions        map[string]models.PeerPermissions
	adminPermissions   map[string]models.AdminPermissions
	bans               map[string]int64
	banGroups          map[string]string
	banLabels          map[string]string
	defaultPermissions models.PeerPermissions
	mu                 sync.RWMutex
}

type banListEntry struct {
	ID            string `json:"id"`
	DisplayName   string `json:"display_name"`
	BannedUntil   int64  `json:"banned_until"`
	Permanent     bool   `json:"permanent"`
	IdentityCount int    `json:"identity_count"`
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
	peer := &Peer{
		id:          uuid.NewString(),
		userID:      userID,
		displayName: username,
		remoteIP:    requestIP(r),
		userAgent:   r.UserAgent(),
		conn:        conn,
		send:        make(chan []byte, 256),
		mode:        "sfu",
		hub:         h,
	}
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
	case "ping":
		h.handlePing(p, msg)
	case "offer", "answer", "ice-candidate":
		p.sendMsg(errMsg("direct browser signaling is disabled"))
	case "media-state", "audio-level":
		if msg.Type == "media-state" {
			h.handleMediaState(p, msg)
			return
		}
		h.broadcast(p.roomID, msg, p.id)
	case "reaction":
		if !p.permissions.CanReact {
			return
		}
		h.handleReaction(p, msg)
	case "chat":
		if !p.permissions.CanChat {
			return
		}
		h.persistChat(p, msg)
		h.broadcast(p.roomID, msg, p.id)
	case "file-offer":
		h.persistFileTransfer(p, msg, "offered")
		h.relay(p, msg)
	case "file-answer":
		h.persistFileTransfer(p, msg, "answered")
		h.relay(p, msg)
	case "file-start", "file-chunk", "file-complete":
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
	case "set-peer-permissions":
		h.handlePeerPermissions(p, msg)
	case "set-admin-permissions":
		h.handleAdminPermissions(p, msg)
	case "set-room-settings":
		h.handleRoomSettings(p, msg)
	case "list-bans":
		h.handleListBans(p)
	case "unban-peer":
		h.handleUnbanPeer(p, msg)
	default:
		p.sendMsg(errMsg("unknown message type"))
	}
}

func (h *Hub) handlePing(p *Peer, msg models.SignalMessage) {
	var body struct {
		ID string `json:"id"`
	}
	if !decodePayload(msg.Payload, &body) || body.ID == "" {
		return
	}
	p.sendMsg(models.SignalMessage{
		Type:    "pong",
		From:    p.id,
		Payload: map[string]string{"id": body.ID},
	})
}

func (h *Hub) handleReaction(p *Peer, msg models.SignalMessage) {
	if p.roomID == "" {
		return
	}
	var body struct {
		Emoji string `json:"emoji"`
	}
	if !decodePayload(msg.Payload, &body) {
		return
	}
	body.Emoji = strings.TrimSpace(body.Emoji)
	if body.Emoji == "" || len([]rune(body.Emoji)) > 4 {
		return
	}
	displayName := strings.TrimSpace(p.displayName)
	if displayName == "" {
		displayName = "Participant"
	}
	reactionText := displayName + " reacted " + body.Emoji
	_, _ = h.db.Exec(
		`INSERT INTO chat_messages (room_id, peer_id, user_id, display_name, text, ts) VALUES (?, ?, ?, ?, ?, ?)`,
		p.roomID, p.id, p.userID, p.displayName, reactionText, time.Now().Unix(),
	)
	h.broadcast(p.roomID, models.SignalMessage{
		Type: "reaction",
		From: p.id,
		Payload: map[string]interface{}{
			"display_name": p.displayName,
			"emoji":        body.Emoji,
			"peer_id":      p.id,
		},
	}, p.id)
	h.broadcast(p.roomID, models.SignalMessage{
		Type: "chat",
		From: p.id,
		Payload: map[string]interface{}{
			"text": reactionText,
		},
	}, "")
}

func (h *Hub) handleMediaState(p *Peer, msg models.SignalMessage) {
	if p.roomID == "" {
		return
	}
	var body struct {
		AudioEnabled      bool   `json:"audio_enabled"`
		AudioStatus       string `json:"audio_status,omitempty"`
		ScreenSharing     bool   `json:"screen_sharing,omitempty"`
		ScreenShareStatus string `json:"screen_share_status,omitempty"`
		VideoEnabled      bool   `json:"video_enabled"`
		VideoStatus       string `json:"video_status,omitempty"`
	}
	if !decodePayload(msg.Payload, &body) {
		return
	}
	if !p.permissions.CanUseMic {
		body.AudioEnabled = false
		body.AudioStatus = "off"
	}
	if !p.permissions.CanUseCamera {
		body.VideoEnabled = false
		body.VideoStatus = "off"
	}
	if !p.permissions.CanShareScreen {
		body.ScreenSharing = false
		body.ScreenShareStatus = "off"
	}
	h.broadcast(p.roomID, models.SignalMessage{Type: "media-state", From: p.id, Payload: body}, p.id)
}

func (h *Hub) handlePeerPermissions(actor *Peer, msg models.SignalMessage) {
	if actor.roomID == "" {
		return
	}
	var req struct {
		PeerID      string                 `json:"peer_id"`
		Permissions models.PeerPermissions `json:"permissions"`
	}
	if !decodePayload(msg.Payload, &req) || req.PeerID == "" {
		actor.sendMsg(errMsg("invalid permissions payload"))
		return
	}
	h.mu.RLock()
	room := h.rooms[actor.roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	room.mu.Lock()
	target := room.peers[req.PeerID]
	room.mu.Unlock()
	if target == nil {
		actor.sendMsg(errMsg("peer not found"))
		return
	}
	if message := protectedPeerError(actor, target); message != "" {
		actor.sendMsg(errMsg(message))
		return
	}
	if !actor.isHost && !actor.isAdmin {
		actor.sendMsg(errMsg("permission denied"))
		return
	}
	if !actor.isHost {
		current := target.permissions
		if current.CanUseMic != req.Permissions.CanUseMic && !canMuteMic(actor) {
			actor.sendMsg(errMsg("permission denied"))
			return
		}
		if current.CanUseCamera != req.Permissions.CanUseCamera && !canDisableCamera(actor) {
			actor.sendMsg(errMsg("permission denied"))
			return
		}
		if current.CanShareScreen != req.Permissions.CanShareScreen && !canDisableScreen(actor) {
			actor.sendMsg(errMsg("permission denied"))
			return
		}
		if current.CanChat != req.Permissions.CanChat && !canDisableChat(actor) {
			actor.sendMsg(errMsg("permission denied"))
			return
		}
		if current.CanReact != req.Permissions.CanReact && !canDisableEmoji(actor) {
			actor.sendMsg(errMsg("permission denied"))
			return
		}
	}
	room.mu.Lock()
	identity := identityKey(target.userID, target.displayName)
	room.permissions[identity] = req.Permissions
	target.permissions = req.Permissions
	room.mu.Unlock()
	h.persistPeerPermissions(actor.roomID, identity, req.Permissions)
	h.broadcast(actor.roomID, models.SignalMessage{Type: "peer-permissions-updated", Payload: map[string]interface{}{"peer_id": target.id, "permissions": req.Permissions}}, "")
}

func (h *Hub) handleAdminPermissions(actor *Peer, msg models.SignalMessage) {
	if !actor.isHost || actor.roomID == "" {
		actor.sendMsg(errMsg("host permission required"))
		return
	}
	var req struct {
		PeerID           string                  `json:"peer_id"`
		IsAdmin          bool                    `json:"is_admin"`
		AdminPermissions models.AdminPermissions `json:"admin_permissions"`
	}
	if !decodePayload(msg.Payload, &req) || req.PeerID == "" {
		actor.sendMsg(errMsg("invalid admin payload"))
		return
	}
	h.mu.RLock()
	room := h.rooms[actor.roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	room.mu.Lock()
	target := room.peers[req.PeerID]
	if target == nil {
		room.mu.Unlock()
		actor.sendMsg(errMsg("peer not found"))
		return
	}
	if target.isHost {
		room.mu.Unlock()
		actor.sendMsg(errMsg("peer not found"))
		return
	}
	identity := identityKey(target.userID, target.displayName)
	if req.IsAdmin {
		room.adminPermissions[identity] = req.AdminPermissions
		target.isAdmin = true
		target.adminPerms = req.AdminPermissions
		h.persistAdminPermissions(actor.roomID, identity, req.AdminPermissions)
	} else {
		delete(room.adminPermissions, identity)
		target.isAdmin = false
		target.adminPerms = models.AdminPermissions{}
		h.deleteAdminPermissions(actor.roomID, identity)
	}
	room.mu.Unlock()
	h.broadcast(actor.roomID, models.SignalMessage{Type: "admin-updated", Payload: map[string]interface{}{"peer_id": target.id, "is_admin": target.isAdmin, "admin_permissions": target.adminPerms}}, "")
}

func (h *Hub) handleRoomSettings(actor *Peer, msg models.SignalMessage) {
	if !actor.isHost || actor.roomID == "" {
		actor.sendMsg(errMsg("host permission required"))
		return
	}
	var req struct {
		JoinPolicy      string                  `json:"join_policy,omitempty"`
		Password        *string                 `json:"password,omitempty"`
		Permissions     *models.PeerPermissions `json:"permissions,omitempty"`
		ApplyToExisting *bool                   `json:"apply_to_existing,omitempty"`
	}
	if !decodePayload(msg.Payload, &req) {
		actor.sendMsg(errMsg("invalid settings payload"))
		return
	}
	if req.JoinPolicy != "" && req.JoinPolicy != "open" && req.JoinPolicy != "approval" {
		actor.sendMsg(errMsg("invalid join policy"))
		return
	}
	if req.JoinPolicy != "" {
		_, _ = h.db.Exec(`UPDATE rooms SET join_policy = ? WHERE id = ?`, req.JoinPolicy, actor.roomID)
	}
	if req.Password != nil {
		passHash := ""
		if *req.Password != "" {
			hash, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
			if err != nil {
				actor.sendMsg(errMsg("could not update room password"))
				return
			}
			passHash = string(hash)
		}
		_, _ = h.db.Exec(`UPDATE rooms SET password = ? WHERE id = ?`, nullableString(passHash), actor.roomID)
	}
	applyToExisting := true
	if req.ApplyToExisting != nil {
		applyToExisting = *req.ApplyToExisting
	}
	if req.Permissions != nil {
		h.mu.RLock()
		room := h.rooms[actor.roomID]
		h.mu.RUnlock()
		if room != nil {
			updates := make(map[string]models.PeerPermissions)
			room.mu.Lock()
			room.defaultPermissions = *req.Permissions
			if applyToExisting {
				for _, peer := range room.peers {
					if peer.isHost {
						continue
					}
					identity := identityKey(peer.userID, peer.displayName)
					room.permissions[identity] = *req.Permissions
					peer.permissions = *req.Permissions
					updates[peer.id] = peer.permissions
					h.persistPeerPermissions(actor.roomID, identity, *req.Permissions)
				}
			}
			room.mu.Unlock()
			h.persistDefaultPermissions(actor.roomID, *req.Permissions)
			if applyToExisting {
				for peerID, permissions := range updates {
					h.broadcast(actor.roomID, models.SignalMessage{Type: "peer-permissions-updated", Payload: map[string]interface{}{"peer_id": peerID, "permissions": permissions}}, "")
				}
			}
		}
	}
	if req.JoinPolicy != "" || req.Password != nil {
		payload := map[string]interface{}{}
		if req.JoinPolicy != "" {
			payload["join_policy"] = req.JoinPolicy
		}
		if req.Password != nil {
			payload["has_password"] = *req.Password != ""
		}
		h.broadcast(actor.roomID, models.SignalMessage{Type: "room-settings-updated", Payload: payload}, "")
	}
}

func (h *Hub) handleListBans(actor *Peer) {
	if !canManageBans(actor) || actor.roomID == "" {
		actor.sendMsg(errMsg("host permission required"))
		return
	}
	h.sendBanList(actor)
}

func (h *Hub) handleUnbanPeer(actor *Peer, msg models.SignalMessage) {
	if !canManageBans(actor) || actor.roomID == "" {
		actor.sendMsg(errMsg("host permission required"))
		return
	}
	var req struct {
		BanID string `json:"ban_id"`
	}
	if !decodePayload(msg.Payload, &req) || strings.TrimSpace(req.BanID) == "" {
		actor.sendMsg(errMsg("invalid unban payload"))
		return
	}
	req.BanID = strings.TrimSpace(req.BanID)

	h.mu.RLock()
	room := h.rooms[actor.roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}

	room.mu.Lock()
	for identity, groupKey := range room.banGroups {
		if identity == req.BanID || groupKey == req.BanID {
			delete(room.bans, identity)
			delete(room.banGroups, identity)
			delete(room.banLabels, identity)
		}
	}
	if _, ok := room.bans[req.BanID]; ok {
		delete(room.bans, req.BanID)
		delete(room.banGroups, req.BanID)
		delete(room.banLabels, req.BanID)
	}
	room.mu.Unlock()

	_, _ = h.db.Exec(
		`DELETE FROM room_bans WHERE room_id = ? AND (identity = ? OR group_key = ?)`,
		actor.roomID,
		req.BanID,
		req.BanID,
	)
	h.sendBanList(actor)
}

func (h *Hub) sendBanList(actor *Peer) {
	h.mu.RLock()
	room := h.rooms[actor.roomID]
	h.mu.RUnlock()
	if room == nil {
		return
	}

	entries := h.banList(room)
	actor.sendMsg(models.SignalMessage{
		Type:    "ban-list",
		Payload: map[string]interface{}{"bans": entries},
	})
}

func (h *Hub) banList(room *Room) []banListEntry {
	now := time.Now().Unix()
	room.mu.RLock()
	defer room.mu.RUnlock()

	byGroup := make(map[string]*banListEntry)
	for identity, bannedUntil := range room.bans {
		if bannedUntil > 0 && bannedUntil <= now {
			continue
		}
		groupKey := room.banGroups[identity]
		if groupKey == "" {
			groupKey = identity
		}
		entry := byGroup[groupKey]
		if entry == nil {
			label := room.banLabels[identity]
			if label == "" {
				label = labelForBanIdentity(identity)
			}
			entry = &banListEntry{
				ID:          groupKey,
				DisplayName: label,
				BannedUntil: bannedUntil,
				Permanent:   bannedUntil == 0,
			}
			byGroup[groupKey] = entry
		}
		entry.IdentityCount++
		if bannedUntil == 0 {
			entry.Permanent = true
			entry.BannedUntil = 0
		} else if !entry.Permanent && bannedUntil > entry.BannedUntil {
			entry.BannedUntil = bannedUntil
		}
	}

	entries := make([]banListEntry, 0, len(byGroup))
	for _, entry := range byGroup {
		entries = append(entries, *entry)
	}
	sort.Slice(entries, func(i, j int) bool {
		return strings.ToLower(entries[i].DisplayName) < strings.ToLower(entries[j].DisplayName)
	})
	return entries
}

func labelForBanIdentity(identity string) string {
	switch {
	case strings.HasPrefix(identity, "name:"):
		return strings.TrimPrefix(identity, "name:")
	case strings.HasPrefix(identity, "user:"):
		return "User " + strings.TrimPrefix(identity, "user:")
	case strings.HasPrefix(identity, "client:"):
		return "Browser " + strings.TrimPrefix(identity, "client:")
	case strings.HasPrefix(identity, "ip:"):
		return "IP " + strings.TrimPrefix(identity, "ip:")
	default:
		return "Blocked participant"
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
	p.clientID = sanitizeClientID(req.ClientID)

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
	if !p.isHost && len(room.peers) == 0 && len(room.pending) == 0 {
		p.isHost = true
	}
	identity := identityKey(p.userID, req.DisplayName)
	for _, banIdentity := range banIdentities(p.userID, req.DisplayName, p.clientID, p.remoteIP, p.userAgent) {
		bannedUntil, ok := room.bans[banIdentity]
		if !ok {
			continue
		}
		if bannedUntil == 0 || bannedUntil > time.Now().Unix() {
			room.mu.Unlock()
			p.sendMsg(errMsg("You are temporarily blocked from joining this meeting."))
			return
		}
		delete(room.bans, banIdentity)
		delete(room.banGroups, banIdentity)
		delete(room.banLabels, banIdentity)
		_, _ = h.db.Exec(`DELETE FROM room_bans WHERE room_id = ? AND identity = ?`, req.RoomID, banIdentity)
	}
	permissions, ok := room.permissions[identity]
	if !ok {
		permissions = room.defaultPermissions
		room.permissions[identity] = permissions
	}
	adminPerms, isAdmin := room.adminPermissions[identity]
	p.permissions = permissions
	p.isAdmin = isAdmin
	if isAdmin {
		p.adminPerms = adminPerms
	}
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
	p.sendMsg(models.SignalMessage{Type: "joined", Payload: map[string]interface{}{"your_id": p.id, "peers": h.getPeerList(req.RoomID, p.id), "mode": p.mode, "is_host": p.isHost, "is_admin": p.isAdmin, "permissions": p.permissions, "admin_permissions": p.adminPerms, "turn_servers": h.sfuMgr.GetTURNCredentials(p.id)}})
	h.broadcast(req.RoomID, models.SignalMessage{Type: "peer-joined", From: p.id, Payload: map[string]interface{}{"peer_id": p.id, "display_name": p.displayName, "is_host": p.isHost, "is_admin": p.isAdmin, "permissions": p.permissions, "admin_permissions": p.adminPerms}}, p.id)
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
	identity := identityKey(peer.userID, peer.displayName)
	permissions, ok := room.permissions[identity]
	if !ok {
		permissions = room.defaultPermissions
		room.permissions[identity] = permissions
	}
	adminPerms, isAdmin := room.adminPermissions[identity]
	peer.permissions = permissions
	peer.isAdmin = isAdmin
	if isAdmin {
		peer.adminPerms = adminPerms
	}
	room.peers[peer.id] = peer
	room.mu.Unlock()
	h.removeClusterPending(host.roomID, peer.id)
	h.upsertClusterPeer(peer)

	go h.logEvent(host.roomID, peer.userID, "join")
	peer.sendMsg(models.SignalMessage{Type: "joined", Payload: map[string]interface{}{"your_id": peer.id, "peers": h.getPeerList(host.roomID, peer.id), "mode": peer.mode, "is_host": false, "is_admin": peer.isAdmin, "permissions": peer.permissions, "admin_permissions": peer.adminPerms, "turn_servers": h.sfuMgr.GetTURNCredentials(peer.id)}})
	h.broadcast(host.roomID, models.SignalMessage{Type: "peer-joined", From: peer.id, Payload: map[string]interface{}{"peer_id": peer.id, "display_name": peer.displayName, "is_host": false, "is_admin": peer.isAdmin, "permissions": peer.permissions, "admin_permissions": peer.adminPerms}}, peer.id)
}

func (h *Hub) handleRejectPeer(host *Peer, msg models.SignalMessage) {
	h.closePendingByHost(host, msg, "join-rejected")
}

func (h *Hub) handleKickPeer(host *Peer, msg models.SignalMessage) {
	if !canKickPeer(host) || host.roomID == "" {
		host.sendMsg(errMsg("host permission required"))
		return
	}
	var req struct {
		PeerID       string `json:"peer_id"`
		Reason       string `json:"reason,omitempty"`
		BanMinutes   int    `json:"ban_minutes,omitempty"`
		BanPermanent bool   `json:"ban_permanent,omitempty"`
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
	if message := protectedPeerError(host, target); message != "" {
		host.sendMsg(errMsg(message))
		return
	}
	if target == nil {
		if !h.publishCluster(cluster.Message{Kind: "kick-peer", RoomID: host.roomID, TargetPeerID: req.PeerID, Signal: models.SignalMessage{Type: "kicked", Payload: map[string]string{"reason": req.Reason}}}) {
			host.sendMsg(errMsg("peer not found"))
		}
		return
	}
	banUntil := int64(0)
	if req.BanPermanent {
		banUntil = 0
	} else if req.BanMinutes > 0 {
		banUntil = time.Now().Add(time.Duration(req.BanMinutes) * time.Minute).Unix()
	}
	if req.BanPermanent || req.BanMinutes > 0 {
		groupKey := "ban:" + uuid.NewString()
		room.mu.Lock()
		if room.banGroups == nil {
			room.banGroups = make(map[string]string)
		}
		if room.banLabels == nil {
			room.banLabels = make(map[string]string)
		}
		identities := banIdentities(target.userID, target.displayName, target.clientID, target.remoteIP, target.userAgent)
		for _, identity := range identities {
			room.bans[identity] = banUntil
			room.banGroups[identity] = groupKey
			room.banLabels[identity] = target.displayName
		}
		room.mu.Unlock()
		for _, identity := range identities {
			h.persistBan(host.roomID, identity, banUntil, target.displayName, groupKey)
		}
	}
	target.sendMsg(models.SignalMessage{Type: "kicked", Payload: map[string]interface{}{"reason": req.Reason, "ban_until": banUntil, "ban_permanent": req.BanPermanent}})
	h.removePeer(target)
}

func (h *Hub) handleMutePeer(host *Peer, msg models.SignalMessage) {
	if host.roomID == "" {
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
	if req.Kind == "audio" && !canMuteMic(host) {
		host.sendMsg(errMsg("host permission required"))
		return
	}
	if req.Kind == "video" && !canDisableCamera(host) {
		host.sendMsg(errMsg("host permission required"))
		return
	}
	if req.Kind == "screen" && !canDisableScreen(host) {
		host.sendMsg(errMsg("host permission required"))
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
	if message := protectedPeerError(host, target); message != "" {
		host.sendMsg(errMsg(message))
		return
	}
	if target == nil {
		if !h.publishCluster(cluster.Message{Kind: "mute-peer", RoomID: host.roomID, TargetPeerID: req.PeerID, Signal: models.SignalMessage{Type: "mute-request", From: host.id, Payload: map[string]string{"kind": req.Kind}}}) {
			host.sendMsg(errMsg("peer not found"))
		}
		return
	}
	room.mu.Lock()
	permissions := target.permissions
	switch req.Kind {
	case "audio":
		permissions.CanUseMic = false
	case "video":
		permissions.CanUseCamera = false
	case "screen":
		permissions.CanShareScreen = false
	}
	identity := identityKey(target.userID, target.displayName)
	room.permissions[identity] = permissions
	target.permissions = permissions
	room.mu.Unlock()
	h.persistPeerPermissions(host.roomID, identity, permissions)
	target.sendMsg(models.SignalMessage{Type: "mute-request", From: host.id, Payload: map[string]string{"kind": req.Kind}})
	h.broadcast(host.roomID, models.SignalMessage{Type: "peer-permissions-updated", Payload: map[string]interface{}{"peer_id": target.id, "permissions": permissions}}, "")
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
	_ = decodePayload(msg.Payload, &stats)
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
	sfuCount := 0
	for _, peer := range room.peers {
		if peer.mode == "sfu" {
			sfuCount++
		}
	}
	return map[string]interface{}{"active": true, "peer_count": len(room.peers), "pending_count": len(room.pending), "sfu_peers": sfuCount, "has_sfu_session": room.sfuSession != nil}
}

func (h *Hub) GetSFUStats() sfu.Stats {
	return h.sfuMgr.Stats()
}

func (h *Hub) getOrCreateRoom(roomID string) *Room {
	h.mu.Lock()
	if room := h.rooms[roomID]; room != nil {
		h.mu.Unlock()
		return room
	}
	room := &Room{
		id:                 roomID,
		peers:              make(map[string]*Peer),
		pending:            make(map[string]*Peer),
		permissions:        make(map[string]models.PeerPermissions),
		adminPermissions:   make(map[string]models.AdminPermissions),
		bans:               make(map[string]int64),
		banGroups:          make(map[string]string),
		banLabels:          make(map[string]string),
		defaultPermissions: defaultPeerPermissions(),
	}
	h.rooms[roomID] = room
	h.mu.Unlock()
	h.loadRoomModerationState(room)
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
			permissions := peer.permissions
			adminPerms := peer.adminPerms
			peers = append(peers, models.PeerInfo{
				ID:          peer.id,
				UserID:      peer.userID,
				DisplayName: peer.displayName,
				Mode:        peer.mode,
				IsHost:      peer.isHost,
				IsAdmin:     peer.isAdmin,
				Permissions: &permissions,
				Admin: func() *models.AdminPermissions {
					if peer.isAdmin {
						return &adminPerms
					}
					return nil
				}(),
			})
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

func (h *Hub) loadRoomModerationState(room *Room) {
	var defaults models.PeerPermissions
	var canUseMic, canUseCamera, canShareScreen, canChat, canReact int
	if err := h.db.QueryRow(
		`SELECT can_use_mic, can_use_camera, can_share_screen, can_chat, can_react
		 FROM room_default_permissions WHERE room_id = ?`,
		room.id,
	).Scan(&canUseMic, &canUseCamera, &canShareScreen, &canChat, &canReact); err == nil {
		defaults = models.PeerPermissions{
			CanUseMic:      boolFromInt(canUseMic),
			CanUseCamera:   boolFromInt(canUseCamera),
			CanShareScreen: boolFromInt(canShareScreen),
			CanChat:        boolFromInt(canChat),
			CanReact:       boolFromInt(canReact),
		}
		room.mu.Lock()
		room.defaultPermissions = defaults
		room.mu.Unlock()
	}

	if rows, err := h.db.Query(
		`SELECT identity, can_use_mic, can_use_camera, can_share_screen, can_chat, can_react
		 FROM room_peer_permissions WHERE room_id = ?`,
		room.id,
	); err == nil {
		defer rows.Close()
		room.mu.Lock()
		for rows.Next() {
			var identity string
			var mic, camera, screen, chat, react int
			if rows.Scan(&identity, &mic, &camera, &screen, &chat, &react) == nil {
				room.permissions[identity] = models.PeerPermissions{
					CanUseMic:      boolFromInt(mic),
					CanUseCamera:   boolFromInt(camera),
					CanShareScreen: boolFromInt(screen),
					CanChat:        boolFromInt(chat),
					CanReact:       boolFromInt(react),
				}
			}
		}
		room.mu.Unlock()
	}

	if rows, err := h.db.Query(
		`SELECT identity, can_kick, can_mute_mic, can_disable_camera, can_disable_screen, can_disable_chat, can_disable_emoji, can_manage_bans
		 FROM room_admin_permissions WHERE room_id = ?`,
		room.id,
	); err == nil {
		defer rows.Close()
		room.mu.Lock()
		for rows.Next() {
			var identity string
			var canKick, canMuteMic, canDisableCamera, canDisableScreen, canDisableChat, canDisableEmoji, canManageBans int
			if rows.Scan(&identity, &canKick, &canMuteMic, &canDisableCamera, &canDisableScreen, &canDisableChat, &canDisableEmoji, &canManageBans) == nil {
				room.adminPermissions[identity] = models.AdminPermissions{
					CanKick:          boolFromInt(canKick),
					CanMuteMic:       boolFromInt(canMuteMic),
					CanDisableCamera: boolFromInt(canDisableCamera),
					CanDisableScreen: boolFromInt(canDisableScreen),
					CanDisableChat:   boolFromInt(canDisableChat),
					CanDisableEmoji:  boolFromInt(canDisableEmoji),
					CanManageBans:    boolFromInt(canManageBans),
				}
			}
		}
		room.mu.Unlock()
	}

	if rows, err := h.db.Query(
		`SELECT identity, banned_until, COALESCE(display_name, ''), COALESCE(group_key, '')
		 FROM room_bans WHERE room_id = ? AND (banned_until = 0 OR banned_until > ?)`,
		room.id,
		time.Now().Unix(),
	); err == nil {
		defer rows.Close()
		room.mu.Lock()
		for rows.Next() {
			var identity, displayName, groupKey string
			var bannedUntil int64
			if rows.Scan(&identity, &bannedUntil, &displayName, &groupKey) == nil {
				room.bans[identity] = bannedUntil
				if displayName != "" {
					room.banLabels[identity] = displayName
				}
				if groupKey != "" {
					room.banGroups[identity] = groupKey
				}
			}
		}
		room.mu.Unlock()
	}
	_, _ = h.db.Exec(`DELETE FROM room_bans WHERE room_id = ? AND banned_until > 0 AND banned_until <= ?`, room.id, time.Now().Unix())
}

func (h *Hub) persistPeerPermissions(roomID, identity string, permissions models.PeerPermissions) {
	_, _ = h.db.Exec(
		`INSERT INTO room_peer_permissions (room_id, identity, can_use_mic, can_use_camera, can_share_screen, can_chat, can_react, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(room_id, identity) DO UPDATE SET
		 can_use_mic = excluded.can_use_mic,
		 can_use_camera = excluded.can_use_camera,
		 can_share_screen = excluded.can_share_screen,
		 can_chat = excluded.can_chat,
		 can_react = excluded.can_react,
		 updated_at = excluded.updated_at`,
		roomID,
		identity,
		intFromBool(permissions.CanUseMic),
		intFromBool(permissions.CanUseCamera),
		intFromBool(permissions.CanShareScreen),
		intFromBool(permissions.CanChat),
		intFromBool(permissions.CanReact),
		time.Now().Unix(),
	)
}

func (h *Hub) persistDefaultPermissions(roomID string, permissions models.PeerPermissions) {
	_, _ = h.db.Exec(
		`INSERT INTO room_default_permissions (room_id, can_use_mic, can_use_camera, can_share_screen, can_chat, can_react, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(room_id) DO UPDATE SET
		 can_use_mic = excluded.can_use_mic,
		 can_use_camera = excluded.can_use_camera,
		 can_share_screen = excluded.can_share_screen,
		 can_chat = excluded.can_chat,
		 can_react = excluded.can_react,
		 updated_at = excluded.updated_at`,
		roomID,
		intFromBool(permissions.CanUseMic),
		intFromBool(permissions.CanUseCamera),
		intFromBool(permissions.CanShareScreen),
		intFromBool(permissions.CanChat),
		intFromBool(permissions.CanReact),
		time.Now().Unix(),
	)
}

func (h *Hub) persistAdminPermissions(roomID, identity string, permissions models.AdminPermissions) {
	_, _ = h.db.Exec(
		`INSERT INTO room_admin_permissions (room_id, identity, can_kick, can_mute_mic, can_disable_camera, can_disable_screen, can_disable_chat, can_disable_emoji, can_manage_bans, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(room_id, identity) DO UPDATE SET
		 can_kick = excluded.can_kick,
		 can_mute_mic = excluded.can_mute_mic,
		 can_disable_camera = excluded.can_disable_camera,
		 can_disable_screen = excluded.can_disable_screen,
		 can_disable_chat = excluded.can_disable_chat,
		 can_disable_emoji = excluded.can_disable_emoji,
		 can_manage_bans = excluded.can_manage_bans,
		 updated_at = excluded.updated_at`,
		roomID,
		identity,
		intFromBool(permissions.CanKick),
		intFromBool(permissions.CanMuteMic),
		intFromBool(permissions.CanDisableCamera),
		intFromBool(permissions.CanDisableScreen),
		intFromBool(permissions.CanDisableChat),
		intFromBool(permissions.CanDisableEmoji),
		intFromBool(permissions.CanManageBans),
		time.Now().Unix(),
	)
}

func (h *Hub) deleteAdminPermissions(roomID, identity string) {
	_, _ = h.db.Exec(`DELETE FROM room_admin_permissions WHERE room_id = ? AND identity = ?`, roomID, identity)
}

func (h *Hub) persistBan(roomID, identity string, bannedUntil int64, displayName, groupKey string) {
	_, _ = h.db.Exec(
		`INSERT INTO room_bans (room_id, identity, banned_until, display_name, group_key, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(room_id, identity) DO UPDATE SET
		 banned_until = excluded.banned_until,
		 display_name = excluded.display_name,
		 group_key = excluded.group_key,
		 created_at = excluded.created_at`,
		roomID,
		identity,
		bannedUntil,
		nullableString(displayName),
		nullableString(groupKey),
		time.Now().Unix(),
	)
}

func nullableString(value string) interface{} {
	if value == "" {
		return nil
	}
	return value
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
	identity := identityKey(peer.userID, peer.displayName)
	permissions, ok := room.permissions[identity]
	if !ok {
		permissions = room.defaultPermissions
		room.permissions[identity] = permissions
	}
	adminPerms, isAdmin := room.adminPermissions[identity]
	peer.permissions = permissions
	peer.isAdmin = isAdmin
	if isAdmin {
		peer.adminPerms = adminPerms
	}
	room.peers[peerID] = peer
	room.mu.Unlock()
	h.removeClusterPending(roomID, peerID)
	h.upsertClusterPeer(peer)
	go h.logEvent(roomID, peer.userID, "join")
	peer.sendMsg(models.SignalMessage{Type: "joined", Payload: map[string]interface{}{"your_id": peer.id, "peers": h.getPeerList(roomID, peer.id), "mode": peer.mode, "is_host": false, "is_admin": peer.isAdmin, "permissions": peer.permissions, "admin_permissions": peer.adminPerms, "turn_servers": h.sfuMgr.GetTURNCredentials(peer.id)}})
	h.broadcast(roomID, models.SignalMessage{Type: "peer-joined", From: peer.id, Payload: map[string]interface{}{"peer_id": peer.id, "display_name": peer.displayName, "is_host": false, "is_admin": peer.isAdmin, "permissions": peer.permissions, "admin_permissions": peer.adminPerms}}, peer.id)
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
	now := time.Now().Unix()
	var result sql.Result
	var err error
	if status == "offered" {
		result, err = h.db.Exec(
			`UPDATE file_transfers
			 SET sender_peer_id = ?,
				 target_peer_id = ?,
				 name = COALESCE(NULLIF(?, ''), name),
				 size = COALESCE(NULLIF(?, 0), size),
				 mime = COALESCE(NULLIF(?, ''), mime),
				 status = ?,
				 reason = ?,
				 ts = ?
			 WHERE room_id = ? AND file_id = ?`,
			p.id, msg.To, body.Name, body.Size, body.MIME, status, body.Reason, now, p.roomID, body.FileID,
		)
	} else {
		result, err = h.db.Exec(
			`UPDATE file_transfers
			 SET status = ?,
				 reason = ?,
				 ts = ?
			 WHERE room_id = ? AND file_id = ?`,
			status, body.Reason, now, p.roomID, body.FileID,
		)
	}
	if err == nil {
		if rowsAffected, rowsErr := result.RowsAffected(); rowsErr == nil && rowsAffected > 0 {
			return
		}
	}
	_, _ = h.db.Exec(
		`INSERT INTO file_transfers (room_id, file_id, sender_peer_id, target_peer_id, name, size, mime, status, reason, ts)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		p.roomID, body.FileID, p.id, msg.To, body.Name, body.Size, body.MIME, status, body.Reason, now,
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
