import { SFUClient } from "@/lib/webrtc/SFUClient";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeSender {
  replaceTrack = vi.fn(async (track: MediaStreamTrack | null) => {
    this.track = track;
  });

  constructor(public track: MediaStreamTrack | null) {}
}

class FakePeerConnection {
  close = vi.fn();
  createOffer = vi.fn(async () => ({
    sdp: `offer-${this.createOffer.mock.calls.length}`,
    type: "offer" as RTCSdpType
  }));
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  signalingState: RTCSignalingState = "stable";
  private readonly senders: FakeSender[] = [];
  private readonly transceivers: RTCRtpTransceiver[] = [];

  addIceCandidate = vi.fn(async () => undefined);

  addTransceiver(kind: "audio" | "video") {
    this.transceivers.push({
      direction: "recvonly",
      receiver: {
        track: { kind }
      }
    } as RTCRtpTransceiver);
  }

  addTrack(track: MediaStreamTrack) {
    this.senders.push(new FakeSender(track));
  }

  getSenders() {
    return this.senders as unknown as RTCRtpSender[];
  }

  getTransceivers() {
    return this.transceivers;
  }

  setLocalDescription = vi.fn(
    async (description: RTCSessionDescriptionInit) => {
      this.localDescription = description;
      this.signalingState = "have-local-offer";
    }
  );

  setRemoteDescription = vi.fn(
    async (description: RTCSessionDescriptionInit) => {
      this.remoteDescription = description;
      this.signalingState = "stable";
    }
  );
}

function fakeTrack(id: string, kind: MediaStreamTrack["kind"]) {
  return { id, kind } as MediaStreamTrack;
}

function fakeStream(tracks: MediaStreamTrack[]) {
  return {
    getTracks: () => tracks
  } as MediaStream;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SFUClient", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "RTCIceCandidate",
      vi.fn((payload) => payload)
    );
  });

  it("syncs changed local tracks and renegotiates the SFU connection", async () => {
    const connection = new FakePeerConnection();
    vi.stubGlobal(
      "RTCPeerConnection",
      vi.fn(() => connection)
    );
    const client = new SFUClient({ onIceCandidate: vi.fn() });
    const cameraTrack = fakeTrack("camera-track", "video");
    const screenTrack = fakeTrack("screen-track", "video");

    await client.start(fakeStream([cameraTrack]));
    expect(connection.getSenders()[0]?.track?.id).toBe("camera-track");
    expect(connection.getTransceivers()).toHaveLength(20);

    connection.signalingState = "stable";
    const offer = await client.syncLocalStream(fakeStream([screenTrack]));

    expect(connection.getSenders()[0]?.track?.id).toBe("screen-track");
    expect(offer).toEqual({ sdp: "offer-2" });
  });

  it("queues renegotiation while an SFU offer is in flight", async () => {
    const connection = new FakePeerConnection();
    vi.stubGlobal(
      "RTCPeerConnection",
      vi.fn(() => connection)
    );
    const client = new SFUClient({ onIceCandidate: vi.fn() });

    await client.start(fakeStream([fakeTrack("camera-track", "video")]));
    const pendingOffer = await client.syncLocalStream(
      fakeStream([fakeTrack("screen-track", "video")])
    );

    expect(pendingOffer).toBeNull();

    const followUpOffer = await client.applyAnswer({ sdp: "answer-sdp" });

    expect(followUpOffer).toEqual({ sdp: "offer-2" });
  });

  it("queues SFU ICE candidates until the answer is applied", async () => {
    const connection = new FakePeerConnection();
    vi.stubGlobal(
      "RTCPeerConnection",
      vi.fn(() => connection)
    );
    const client = new SFUClient({ onIceCandidate: vi.fn() });

    await client.start(fakeStream([fakeTrack("camera-track", "video")]));
    await client.addIceCandidate({
      candidate: "candidate",
      sdpMLineIndex: 0,
      sdpMid: "0"
    });

    expect(connection.addIceCandidate).not.toHaveBeenCalled();

    await client.applyAnswer({ sdp: "answer-sdp" });

    expect(connection.addIceCandidate).toHaveBeenCalledTimes(1);
  });
});
