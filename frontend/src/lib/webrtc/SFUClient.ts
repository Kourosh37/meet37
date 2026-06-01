import type {
  IceCandidatePayload,
  SessionDescriptionPayload,
  TurnServerConfig
} from "@/features/meeting/types/signaling";
import {
  addLocalTracks,
  closePeerConnection,
  createPeerConnection,
  payloadToIceCandidate,
  payloadToSessionDescription,
  sessionDescriptionToPayload,
  syncLocalTracks
} from "@/lib/webrtc/PeerConnectionFactory";

export class SFUClient {
  private connection: RTCPeerConnection | null = null;
  private makingOffer = false;
  private pendingOffer = false;

  constructor(
    private readonly options: {
      onIceCandidate: (payload: IceCandidatePayload) => void;
      onTrack?: (event: RTCTrackEvent) => void;
    }
  ) {}

  async start(
    localStream: MediaStream | null,
    turnServers: TurnServerConfig[] = []
  ) {
    this.close();
    this.connection = createPeerConnection({
      iceServers: turnServers,
      onIceCandidate: this.options.onIceCandidate,
      onTrack: this.options.onTrack
    });

    if (localStream) {
      await addLocalTracks(this.connection, localStream);
    }

    return this.createOffer();
  }

  async createOffer() {
    if (!this.connection) {
      throw new Error("SFU connection is not initialized");
    }

    if (this.makingOffer || this.connection.signalingState !== "stable") {
      this.pendingOffer = true;
      return null;
    }

    this.makingOffer = true;

    try {
      const offer = await this.connection.createOffer();
      await this.connection.setLocalDescription(offer);
      return sessionDescriptionToPayload(offer);
    } finally {
      this.makingOffer = false;
    }
  }

  async applyAnswer(payload: SessionDescriptionPayload) {
    await this.connection?.setRemoteDescription(
      payloadToSessionDescription("answer", payload)
    );

    if (this.pendingOffer) {
      this.pendingOffer = false;
      return this.createOffer();
    }

    return null;
  }

  async addIceCandidate(payload: IceCandidatePayload) {
    await this.connection?.addIceCandidate(payloadToIceCandidate(payload));
  }

  async syncLocalStream(localStream: MediaStream | null) {
    if (!this.connection || !localStream) {
      return null;
    }

    await syncLocalTracks(this.connection, localStream);
    return this.createOffer();
  }

  close() {
    closePeerConnection(this.connection);
    this.connection = null;
    this.makingOffer = false;
    this.pendingOffer = false;
  }
}
