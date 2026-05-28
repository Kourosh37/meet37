package sfu

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"io"
	"sync"
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
}

type Manager struct {
	cfg      *config.Config
	api      *webrtc.API
	mu       sync.RWMutex
	sessions map[string]*Session
}

func NewManager(cfg *config.Config) *Manager {
	return &Manager{
		cfg:      cfg,
		api:      webrtc.NewAPI(),
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
		ID:        uuid.NewString(),
		RoomID:    roomID,
		CreatedAt: time.Now().Unix(),
		peers:     make(map[string]*Peer),
		tracks:    make(map[string]*forwardedTrack),
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
	s.tracks = map[string]*forwardedTrack{}
	s.mu.Unlock()
	for _, peer := range peers {
		_ = peer.pc.Close()
	}
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
