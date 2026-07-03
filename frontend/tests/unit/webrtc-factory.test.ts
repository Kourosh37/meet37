import {
  iceCandidateToPayload,
  payloadToSessionDescription,
  sessionDescriptionToPayload,
  syncLocalTracks
} from "@/lib/webrtc/PeerConnectionFactory";
import { describe, expect, it } from "vitest";

class FakeSender {
  replaceTrackCalls: Array<MediaStreamTrack | null> = [];

  constructor(public track: MediaStreamTrack | null) {}

  async replaceTrack(track: MediaStreamTrack | null) {
    this.replaceTrackCalls.push(track);
    this.track = track;
  }
}

class FakeConnection {
  senders: FakeSender[] = [];
  transceivers: RTCRtpTransceiver[] = [];

  addTrack(track: MediaStreamTrack) {
    const sender = new FakeSender(track);
    this.senders.push(sender);
    this.transceivers.push({
      direction: "sendrecv",
      receiver: { track: { kind: track.kind } },
      sender
    } as unknown as RTCRtpTransceiver);
  }

  getSenders() {
    return this.senders as unknown as RTCRtpSender[];
  }

  getTransceivers() {
    return this.transceivers;
  }
}

function fakeTrack(id: string, kind: MediaStreamTrack["kind"]) {
  return { id, kind } as MediaStreamTrack;
}

function fakeStream(tracks: MediaStreamTrack[]) {
  return {
    getTracks: () => tracks
  } as MediaStream;
}

describe("PeerConnectionFactory helpers", () => {
  it("normalizes session descriptions", () => {
    expect(
      sessionDescriptionToPayload({ sdp: "offer-sdp", type: "offer" })
    ).toEqual({
      sdp: "offer-sdp"
    });
    expect(
      payloadToSessionDescription("answer", { sdp: "answer-sdp" })
    ).toEqual({
      sdp: "answer-sdp",
      type: "answer"
    });
  });

  it("normalizes ICE candidates", () => {
    const candidate = {
      candidate: "candidate",
      sdpMLineIndex: 0,
      sdpMid: "0"
    } as RTCIceCandidate;

    expect(iceCandidateToPayload(candidate)).toEqual({
      candidate: "candidate",
      sdpMLineIndex: 0,
      sdpMid: "0"
    });
  });

  it("replaces the matching sender kind when local media changes", async () => {
    const connection = new FakeConnection();
    const cameraTrack = fakeTrack("camera", "video");
    const micTrack = fakeTrack("mic", "audio");
    const screenTrack = fakeTrack("screen", "video");

    connection.addTrack(cameraTrack);
    connection.addTrack(micTrack);

    await syncLocalTracks(
      connection as unknown as RTCPeerConnection,
      fakeStream([screenTrack, micTrack])
    );

    expect(connection.senders[0]?.track?.id).toBe("screen");
    expect(connection.senders[1]?.track?.id).toBe("mic");
  });

  it("detaches missing senders without removing transceivers", async () => {
    const connection = new FakeConnection();
    const cameraTrack = fakeTrack("camera", "video");
    const micTrack = fakeTrack("mic", "audio");

    connection.addTrack(cameraTrack);
    connection.addTrack(micTrack);

    await syncLocalTracks(connection as unknown as RTCPeerConnection, null);

    expect(connection.senders[0]?.track).toBeNull();
    expect(connection.senders[1]?.track).toBeNull();
    expect(connection.getTransceivers()).toHaveLength(2);
  });

  it("keeps recvonly transceivers available and publishes new local tracks separately", async () => {
    const connection = new FakeConnection();
    const sender = new FakeSender(null);
    connection.senders.push(sender);
    connection.transceivers.push({
      direction: "recvonly",
      receiver: { track: { kind: "video" } },
      sender
    } as unknown as RTCRtpTransceiver);

    await syncLocalTracks(
      connection as unknown as RTCPeerConnection,
      fakeStream([fakeTrack("camera", "video")])
    );

    expect(sender.track).toBeNull();
    expect(connection.transceivers[0]?.direction).toBe("recvonly");
    expect(connection.senders[1]?.track?.id).toBe("camera");
    expect(connection.transceivers[1]?.direction).toBe("sendrecv");
  });

  it("can upgrade recvonly transceivers when P2P local media arrives late", async () => {
    const connection = new FakeConnection();
    const sender = new FakeSender(null);
    connection.senders.push(sender);
    connection.transceivers.push({
      direction: "recvonly",
      receiver: { track: { kind: "video" } },
      sender
    } as unknown as RTCRtpTransceiver);

    await syncLocalTracks(
      connection as unknown as RTCPeerConnection,
      fakeStream([fakeTrack("camera", "video")]),
      { reuseRecvOnly: true }
    );

    expect(connection.senders).toHaveLength(1);
    expect(sender.track?.id).toBe("camera");
    expect(connection.transceivers[0]?.direction).toBe("sendrecv");
  });
});
