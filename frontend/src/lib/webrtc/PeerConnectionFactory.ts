/*
Frontend architecture note

File: src\lib\webrtc\PeerConnectionFactory.ts
Layer: WebRTC Infrastructure

Responsibility:
- Factory and helpers for browser RTCPeerConnection instances, ICE server configuration, local track attachment, data channels, and cleanup.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: backend relays signaling only in P2P mode and announces SFU fallback through WebSocket. Browser media/data logic stays client-side.

State model to plan: loading, ready, empty, recoverable error, fatal error, and cleanup/unmount behavior where applicable.

UX and edge cases to plan:
- Display clear loading and empty states instead of rendering nothing once implementation starts.
- Normalize backend errors into user-safe messages while preserving technical details for logger.ts.
- Keep room links shareable; never require global login just to open an existing meeting link.
- In private app mode, require login only for room creation, not for joining a shared room link.
- Every meeting participant must provide a non-empty display name before joining.

Security and privacy notes:
- Never expose refresh tokens to arbitrary components; use the storage/auth layer only.
- Treat host_token as room-scoped moderation authority and avoid leaking it into URLs or logs.
- Do not persist raw media streams, SDP blobs, ICE candidates, or file bytes unless a later backend feature explicitly requires it.

Future tests: success path, loading path, error path, accessibility expectations, and cleanup/side-effect boundaries.

*/

import type {
  IceCandidatePayload,
  SessionDescriptionPayload
} from "@/features/meeting/types/signaling";

const defaultIceServers: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302"] }
];

export interface PeerConnectionFactoryOptions {
  iceServers?: RTCIceServer[];
  onDataChannel?: (event: RTCDataChannelEvent) => void;
  onIceCandidate?: (candidate: IceCandidatePayload) => void;
  onTrack?: (event: RTCTrackEvent) => void;
}

export function createPeerConnection(
  options: PeerConnectionFactoryOptions = {}
) {
  const connection = new RTCPeerConnection({
    iceServers: options.iceServers ?? defaultIceServers
  });

  connection.onicecandidate = (event) => {
    if (!event.candidate) {
      return;
    }

    options.onIceCandidate?.(iceCandidateToPayload(event.candidate));
  };

  if (options.onTrack) {
    connection.ontrack = options.onTrack;
  }

  if (options.onDataChannel) {
    connection.ondatachannel = options.onDataChannel;
  }

  return connection;
}

export function addLocalTracks(
  connection: RTCPeerConnection,
  stream: MediaStream
) {
  const existingTrackIds = new Set(
    connection
      .getSenders()
      .map((sender) => sender.track?.id)
      .filter(Boolean)
  );

  stream.getTracks().forEach((track) => {
    if (!existingTrackIds.has(track.id)) {
      connection.addTrack(track, stream);
    }
  });
}

export function syncLocalTracks(
  connection: RTCPeerConnection,
  stream: MediaStream
) {
  const tracksByKind = new Map(stream.getTracks().map((track) => [track.kind, track]));

  connection.getSenders().forEach((sender) => {
    const track = sender.track;

    if (!track) {
      return;
    }

    const replacement = tracksByKind.get(track.kind);

    if (!replacement) {
      connection.removeTrack(sender);
      return;
    }

    if (replacement.id !== track.id) {
      void sender.replaceTrack(replacement);
    }
  });

  addLocalTracks(connection, stream);
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function closePeerConnection(
  connection: RTCPeerConnection | null | undefined
) {
  connection?.close();
}

export function sessionDescriptionToPayload(
  description: RTCSessionDescriptionInit
) {
  return {
    sdp: description.sdp ?? ""
  } satisfies SessionDescriptionPayload;
}

export function payloadToSessionDescription(
  type: RTCSdpType,
  payload: SessionDescriptionPayload
) {
  return {
    sdp: payload.sdp,
    type
  } satisfies RTCSessionDescriptionInit;
}

export function iceCandidateToPayload(candidate: RTCIceCandidate) {
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex
  } satisfies IceCandidatePayload;
}

export function payloadToIceCandidate(payload: IceCandidatePayload) {
  return new RTCIceCandidate(payload);
}
