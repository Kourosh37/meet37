package sfu

import (
	"strings"
	"testing"
	"time"

	"meet-backend/internal/config"

	"github.com/pion/rtcp"
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
	if !strings.Contains(answer, " 127.0.0.1 ") {
		t.Fatalf("expected SFU answer to advertise configured host IP, got SDP:\n%s", answer)
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

func TestWantsKeyFrameRecognizesVideoFeedback(t *testing.T) {
	if !wantsKeyFrame([]rtcp.Packet{&rtcp.PictureLossIndication{MediaSSRC: 1}}) {
		t.Fatal("expected PLI to request a keyframe")
	}
	if !wantsKeyFrame([]rtcp.Packet{&rtcp.FullIntraRequest{FIR: []rtcp.FIREntry{{SSRC: 1}}}}) {
		t.Fatal("expected FIR to request a keyframe")
	}
	if wantsKeyFrame([]rtcp.Packet{&rtcp.ReceiverReport{}}) {
		t.Fatal("receiver reports should not request keyframes")
	}
}

func TestRemoveOwnerTracksByKindKeepsCurrentMediaStateClean(t *testing.T) {
	session := &Session{tracks: map[string]*forwardedTrack{
		"old-video": {ownerID: "peer-1", mimeType: webrtc.MimeTypeVP8},
		"audio":     {ownerID: "peer-1", mimeType: webrtc.MimeTypeOpus},
		"other":     {ownerID: "peer-2", mimeType: webrtc.MimeTypeVP8},
	}}

	session.removeOwnerTracksByKindLocked("peer-1", "video")

	if session.tracks["old-video"] != nil {
		t.Fatal("expected old owner video track to be removed")
	}
	if session.tracks["audio"] == nil {
		t.Fatal("audio from the same owner should be retained")
	}
	if session.tracks["other"] == nil {
		t.Fatal("tracks from other owners should be retained")
	}
}
