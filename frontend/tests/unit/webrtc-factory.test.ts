import {
  iceCandidateToPayload,
  payloadToSessionDescription,
  sessionDescriptionToPayload
} from "@/lib/webrtc/PeerConnectionFactory";
import { describe, expect, it } from "vitest";

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
});
