package sfu

import (
	"testing"
	"time"

	"meet-backend/internal/config"

	"github.com/pion/webrtc/v4"
)

func TestManagerCreatesAnswerForSFUOffer(t *testing.T) {
	cfg := &config.Config{TURNPublicIP: "127.0.0.1", TURNPort: 3478, TURNSecret: "test"}
	mgr := NewManager(cfg)

	client, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	if _, err := client.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio, webrtc.RTPTransceiverInit{Direction: webrtc.RTPTransceiverDirectionSendrecv}); err != nil {
		t.Fatal(err)
	}

	offer, err := client.CreateOffer(nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := client.SetLocalDescription(offer); err != nil {
		t.Fatal(err)
	}

	answer, err := mgr.HandleOffer("room", "peer", offer.SDP, func(webrtc.ICECandidateInit) {}, func(string, map[string]interface{}) {})
	if err != nil {
		t.Fatal(err)
	}
	if answer == "" {
		t.Fatal("empty SFU answer")
	}
	if err := client.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: answer}); err != nil {
		t.Fatal(err)
	}
}

func TestManagerAddsExistingTracksWithoutDeadlock(t *testing.T) {
	cfg := &config.Config{TURNPublicIP: "127.0.0.1", TURNPort: 3478, TURNSecret: "test"}
	mgr := NewManager(cfg)
	session := mgr.CreateSession("room")

	local, err := webrtc.NewTrackLocalStaticRTP(webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus}, "audio", "stream")
	if err != nil {
		t.Fatal(err)
	}
	session.tracks["track"] = &forwardedTrack{
		id:       "track",
		ownerID:  "publisher",
		trackID:  "audio",
		streamID: "stream",
		mimeType: webrtc.MimeTypeOpus,
		local:    local,
	}

	client, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	if _, err := client.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio, webrtc.RTPTransceiverInit{Direction: webrtc.RTPTransceiverDirectionRecvonly}); err != nil {
		t.Fatal(err)
	}

	done := make(chan error, 1)
	go func() {
		offer, err := client.CreateOffer(nil)
		if err != nil {
			done <- err
			return
		}
		if err := client.SetLocalDescription(offer); err != nil {
			done <- err
			return
		}
		answer, err := mgr.HandleOffer("room", "subscriber", offer.SDP, func(webrtc.ICECandidateInit) {}, func(string, map[string]interface{}) {})
		if err != nil {
			done <- err
			return
		}
		done <- client.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: answer})
	}()

	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("HandleOffer deadlocked while adding existing tracks")
	}
}
