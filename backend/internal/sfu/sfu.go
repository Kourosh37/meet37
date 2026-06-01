package sfu

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"meet-backend/internal/config"

	"github.com/google/uuid"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
)

type Session struct {
	ID        string `json:"id"`
	RoomID    string `json:"room_id"`
	CreatedAt int64  `json:"created_at"`

	mu     sync.RWMutex
	peers  map[string]*Peer
	tracks map[string]*forwardedTrack
	stats  SessionStats

	recordingEnabled bool
	recordingPath    string
}

type Peer struct {
	ID string

	pc          *webrtc.PeerConnection
	onCandidate func(candidate webrtc.ICECandidateInit)
	onSignal    func(signalType string, payload map[string]interface{})

	mu      sync.Mutex
	senders map[string]*webrtc.RTPSender
}

type forwardedTrack struct {
	id        string
	ownerID   string
	trackID   string
	streamID  string
	mimeType  string
	local     *webrtc.TrackLocalStaticRTP
	createdAt int64
	recording *os.File
}

type SessionStats struct {
	PeerCount      int    `json:"peer_count"`
	TrackCount     int    `json:"track_count"`
	PacketsRelayed uint64 `json:"packets_relayed"`
	BytesRelayed   uint64 `json:"bytes_relayed"`
	Recordings     int    `json:"recordings"`
}

type Stats struct {
	SessionCount int                     `json:"session_count"`
	Sessions     map[string]SessionStats `json:"sessions"`
}

type Manager struct {
	cfg      *config.Config
	api      *webrtc.API
	mu       sync.RWMutex
	sessions map[string]*Session
}

func NewManager(cfg *config.Config) *Manager {
	settingEngine := webrtc.SettingEngine{}
	if cfg.WebRTCUDPPortMin > 0 && cfg.WebRTCUDPPortMax >= cfg.WebRTCUDPPortMin {
		_ = settingEngine.SetEphemeralUDPPortRange(
			uint16(cfg.WebRTCUDPPortMin),
			uint16(cfg.WebRTCUDPPortMax),
		)
	}
	if cfg.TURNPublicIP != "" && cfg.TURNPublicIP != "127.0.0.1" && cfg.TURNPublicIP != "localhost" {
		settingEngine.SetNAT1To1IPs(
			[]string{cfg.TURNPublicIP},
			webrtc.ICECandidateTypeHost,
		)
	}

	return &Manager{
		cfg:      cfg,
		api:      webrtc.NewAPI(webrtc.WithSettingEngine(settingEngine)),
		sessions: make(map[string]*Session),
	}
}

func (m *Manager) CreateSession(roomID string) *Session {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s := m.sessions[roomID]; s != nil {
		return s
	}
	s := &Session{
		ID:               uuid.NewString(),
		RoomID:           roomID,
		CreatedAt:        time.Now().Unix(),
		peers:            make(map[string]*Peer),
		tracks:           make(map[string]*forwardedTrack),
		recordingEnabled: m.cfg.SFURecordingEnabled,
		recordingPath:    m.cfg.SFURecordingPath,
	}
	m.sessions[roomID] = s
	return s
}

func (m *Manager) DeleteSession(roomID string) {
	m.mu.Lock()
	session := m.sessions[roomID]
	delete(m.sessions, roomID)
	m.mu.Unlock()
	if session != nil {
		session.close()
	}
}

func (m *Manager) RemovePeer(roomID, peerID string) {
	m.mu.RLock()
	session := m.sessions[roomID]
	m.mu.RUnlock()
	if session != nil {
		session.removePeer(peerID)
	}
}

func (m *Manager) HandleOffer(roomID, peerID, offerSDP string, onCandidate func(webrtc.ICECandidateInit), onSignal func(string, map[string]interface{})) (string, error) {
	session := m.CreateSession(roomID)
	peer, err := session.ensurePeer(m, peerID, onCandidate, onSignal)
	if err != nil {
		return "", err
	}

	session.addExistingTracksToPeer(peer)

	peer.mu.Lock()
	defer peer.mu.Unlock()

	offer := webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: offerSDP}
	if err := peer.pc.SetRemoteDescription(offer); err != nil {
		return "", fmt.Errorf("set remote description: %w", err)
	}
	answer, err := peer.pc.CreateAnswer(nil)
	if err != nil {
		return "", fmt.Errorf("create answer: %w", err)
	}
	gatherComplete := webrtc.GatheringCompletePromise(peer.pc)
	if err := peer.pc.SetLocalDescription(answer); err != nil {
		return "", fmt.Errorf("set local description: %w", err)
	}
	select {
	case <-gatherComplete:
	case <-time.After(5 * time.Second):
		return "", fmt.Errorf("ice gathering timed out")
	}
	return peer.pc.LocalDescription().SDP, nil
}

func (m *Manager) AddICECandidate(roomID, peerID string, candidate webrtc.ICECandidateInit) error {
	m.mu.RLock()
	session := m.sessions[roomID]
	m.mu.RUnlock()
	if session == nil {
		return fmt.Errorf("sfu session not found")
	}
	session.mu.RLock()
	peer := session.peers[peerID]
	session.mu.RUnlock()
	if peer == nil {
		return fmt.Errorf("sfu peer not found")
	}
	return peer.pc.AddICECandidate(candidate)
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

func (m *Manager) Stats() Stats {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := Stats{SessionCount: len(m.sessions), Sessions: make(map[string]SessionStats, len(m.sessions))}
	for roomID, session := range m.sessions {
		out.Sessions[roomID] = session.Stats()
	}
	return out
}

func (s *Session) ensurePeer(m *Manager, peerID string, onCandidate func(webrtc.ICECandidateInit), onSignal func(string, map[string]interface{})) (*Peer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p := s.peers[peerID]; p != nil {
		p.onCandidate = onCandidate
		p.onSignal = onSignal
		return p, nil
	}

	pc, err := m.api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		return nil, err
	}
	peer := &Peer{ID: peerID, pc: pc, onCandidate: onCandidate, onSignal: onSignal, senders: make(map[string]*webrtc.RTPSender)}
	s.peers[peerID] = peer

	pc.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c != nil && peer.onCandidate != nil {
			peer.onCandidate(c.ToJSON())
		}
	})
	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		if state == webrtc.PeerConnectionStateFailed || state == webrtc.PeerConnectionStateClosed || state == webrtc.PeerConnectionStateDisconnected {
			s.removePeer(peerID)
		}
	})
	pc.OnTrack(func(remote *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		s.handleRemoteTrack(peerID, remote, receiver)
	})

	return peer, nil
}

func (s *Session) handleRemoteTrack(ownerID string, remote *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
	local, err := webrtc.NewTrackLocalStaticRTP(remote.Codec().RTPCodecCapability, remote.ID(), remote.StreamID())
	if err != nil {
		return
	}
	ft := &forwardedTrack{
		id:        uuid.NewString(),
		ownerID:   ownerID,
		trackID:   remote.ID(),
		streamID:  remote.StreamID(),
		mimeType:  remote.Codec().MimeType,
		local:     local,
		createdAt: time.Now().Unix(),
	}
	ft.recording = s.openRecording(ownerID, remote)

	s.mu.Lock()
	s.tracks[ft.id] = ft
	for _, peer := range s.peers {
		if peer.ID != ownerID {
			s.addTrackToPeerLocked(peer, ft)
		}
	}
	s.mu.Unlock()

	go readRTCP(receiver)
	go func() {
		for {
			pkt, _, err := remote.ReadRTP()
			if err != nil {
				if err != io.EOF {
					// Track ended or peer disconnected; cleanup is handled by peer lifecycle.
				}
				return
			}
			cloned := &rtp.Packet{}
			*cloned = *pkt
			if err := local.WriteRTP(cloned); err != nil {
				return
			}
			atomic.AddUint64(&s.stats.PacketsRelayed, 1)
			atomic.AddUint64(&s.stats.BytesRelayed, uint64(pkt.MarshalSize()))
			if ft.recording != nil {
				if raw, err := pkt.Marshal(); err == nil {
					_, _ = ft.recording.Write(raw)
				}
			}
		}
	}()
}

func (s *Session) addExistingTracksToPeer(peer *Peer) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, track := range s.tracks {
		if track.ownerID != peer.ID {
			s.addTrackToPeerLocked(peer, track)
		}
	}
}

func (s *Session) addTrackToPeerLocked(peer *Peer, track *forwardedTrack) {
	peer.mu.Lock()
	defer peer.mu.Unlock()
	if peer.senders[track.id] != nil {
		return
	}
	sender, err := peer.pc.AddTrack(track.local)
	if err != nil {
		return
	}
	peer.senders[track.id] = sender
	go readSenderRTCP(sender)
	if peer.onSignal != nil {
		peer.onSignal("sfu-renegotiate-needed", map[string]interface{}{
			"session_id": s.ID,
			"track_id":   track.trackID,
			"stream_id":  track.streamID,
			"owner_id":   track.ownerID,
			"mime_type":  track.mimeType,
		})
	}
}

func (s *Session) removePeer(peerID string) {
	s.mu.Lock()
	peer := s.peers[peerID]
	delete(s.peers, peerID)
	for id, track := range s.tracks {
		if track.ownerID == peerID {
			if track.recording != nil {
				_ = track.recording.Close()
			}
			delete(s.tracks, id)
		}
	}
	s.mu.Unlock()
	if peer != nil {
		_ = peer.pc.Close()
	}
}

func (s *Session) close() {
	s.mu.Lock()
	peers := make([]*Peer, 0, len(s.peers))
	for _, peer := range s.peers {
		peers = append(peers, peer)
	}
	s.peers = map[string]*Peer{}
	for _, track := range s.tracks {
		if track.recording != nil {
			_ = track.recording.Close()
		}
	}
	s.tracks = map[string]*forwardedTrack{}
	s.mu.Unlock()
	for _, peer := range peers {
		_ = peer.pc.Close()
	}
}

func (s *Session) Stats() SessionStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	recordings := 0
	for _, track := range s.tracks {
		if track.recording != nil {
			recordings++
		}
	}
	return SessionStats{
		PeerCount:      len(s.peers),
		TrackCount:     len(s.tracks),
		PacketsRelayed: atomic.LoadUint64(&s.stats.PacketsRelayed),
		BytesRelayed:   atomic.LoadUint64(&s.stats.BytesRelayed),
		Recordings:     recordings,
	}
}

func (s *Session) openRecording(ownerID string, remote *webrtc.TrackRemote) *os.File {
	// RTP recording is deliberately raw and append-only. It is useful for
	// diagnostics and later processing, but it is not a playable media file.
	if remote == nil || remote.Kind() == webrtc.RTPCodecTypeUnknown {
		return nil
	}
	if !s.recordingEnabled || s.recordingPath == "" {
		return nil
	}
	if err := os.MkdirAll(s.recordingPath, 0o750); err != nil {
		return nil
	}
	name := fmt.Sprintf("%s_%s_%s_%d.rtp", s.RoomID, ownerID, remote.ID(), time.Now().UnixNano())
	f, err := os.Create(filepath.Join(s.recordingPath, name))
	if err != nil {
		return nil
	}
	return f
}

func readRTCP(receiver *webrtc.RTPReceiver) {
	for {
		if _, _, err := receiver.ReadRTCP(); err != nil {
			return
		}
	}
}

func readSenderRTCP(sender *webrtc.RTPSender) {
	buf := make([]byte, 1500)
	for {
		if _, _, err := sender.Read(buf); err != nil {
			return
		}
	}
}
