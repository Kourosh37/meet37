import type {
  IceCandidatePayload,
  SessionDescriptionPayload,
  TurnServerConfig
} from "@/features/meeting/types/signaling";
import {
  addLocalTracks,
  closePeerConnection,
  createPeerConnection,
  ensureRecvTransceivers,
  payloadToIceCandidate,
  payloadToSessionDescription,
  sessionDescriptionToPayload,
  syncLocalTracks
} from "@/lib/webrtc/PeerConnectionFactory";

export class SFUClient {
  private connection: RTCPeerConnection | null = null;
  private makingOffer = false;
  private pendingOffer = false;
  private pendingIceCandidates: IceCandidatePayload[] = [];

  constructor(
    private readonly options: {
      onIceCandidate: (payload: IceCandidatePayload) => void;
      onOffer?: (payload: SessionDescriptionPayload) => void;
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
    this.connection.onnegotiationneeded = () => {
      void this.createOffer().then((offer) => {
        if (offer) {
          this.options.onOffer?.(offer);
        }
      });
    };
    this.connection.onsignalingstatechange = () => {
      if (!this.connection) {
        return;
      }

      if (this.connection.signalingState !== "stable" || !this.pendingOffer) {
        return;
      }

      this.pendingOffer = false;
      void this.createOffer().then((offer) => {
        if (offer) {
          this.options.onOffer?.(offer);
        }
      });
    };
    this.connection.oniceconnectionstatechange = () => {
      if (
        !this.connection ||
        !["failed", "disconnected"].includes(this.connection.iceConnectionState)
      ) {
        return;
      }

      window.setTimeout(
        () => {
          if (!this.connection) {
            return;
          }

          try {
            this.connection.restartIce();
          } catch {
            return;
          }
          void this.createOffer().then((offer) => {
            if (offer) {
              this.options.onOffer?.(offer);
            }
          });
        },
        this.connection.iceConnectionState === "failed" ? 0 : 800
      );
    };
    ensureRecvTransceivers(this.connection, { audio: 8, video: 12 });

    if (localStream) {
      await addLocalTracks(this.connection, localStream);
    }

    return this.createOffer();
  }

  async createOffer() {
    if (!this.connection) {
      return null;
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
    await this.flushPendingIceCandidates();

    if (this.pendingOffer) {
      this.pendingOffer = false;
      return this.createOffer();
    }

    return null;
  }

  async addIceCandidate(payload: IceCandidatePayload) {
    if (!this.connection?.remoteDescription) {
      this.pendingIceCandidates.push(payload);
      return;
    }

    await this.connection
      .addIceCandidate(payloadToIceCandidate(payload))
      .catch(() => undefined);
  }

  async syncLocalStream(localStream: MediaStream | null) {
    if (!this.connection) {
      return null;
    }

    await syncLocalTracks(this.connection, localStream);
    return this.createOffer();
  }

  getConnection() {
    return this.connection;
  }

  private async flushPendingIceCandidates() {
    if (!this.connection?.remoteDescription) {
      return;
    }

    const pending = [...this.pendingIceCandidates];
    this.pendingIceCandidates = [];
    for (const payload of pending) {
      await this.connection
        .addIceCandidate(payloadToIceCandidate(payload))
        .catch(() => undefined);
    }
  }

  close() {
    closePeerConnection(this.connection);
    this.connection = null;
    this.makingOffer = false;
    this.pendingOffer = false;
    this.pendingIceCandidates = [];
  }
}
