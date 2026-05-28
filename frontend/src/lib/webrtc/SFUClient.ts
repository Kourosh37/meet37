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
  sessionDescriptionToPayload
} from "@/lib/webrtc/PeerConnectionFactory";

export class SFUClient {
  private connection: RTCPeerConnection | null = null;

  constructor(
    private readonly options: {
      onIceCandidate: (payload: IceCandidatePayload) => void;
    }
  ) {}

  async start(
    localStream: MediaStream | null,
    turnServers: TurnServerConfig[] = []
  ) {
    this.close();
    this.connection = createPeerConnection({
      iceServers: turnServers,
      onIceCandidate: this.options.onIceCandidate
    });

    if (localStream) {
      addLocalTracks(this.connection, localStream);
    }

    return this.createOffer();
  }

  async createOffer() {
    if (!this.connection) {
      throw new Error("SFU connection is not initialized");
    }

    const offer = await this.connection.createOffer();
    await this.connection.setLocalDescription(offer);
    return sessionDescriptionToPayload(offer);
  }

  async applyAnswer(payload: SessionDescriptionPayload) {
    await this.connection?.setRemoteDescription(
      payloadToSessionDescription("answer", payload)
    );
  }

  async addIceCandidate(payload: IceCandidatePayload) {
    await this.connection?.addIceCandidate(payloadToIceCandidate(payload));
  }

  close() {
    closePeerConnection(this.connection);
    this.connection = null;
  }
}
