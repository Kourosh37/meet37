/*
Frontend architecture note

File: src\features\meeting\hooks\usePeerConnection.ts
Layer: Meeting Runtime

Responsibility:
- Frontend file for the Meeting Runtime layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: WebSocket signaling endpoint described in backend/docs/WEBSOCKET.md plus room metadata from GET /api/rooms/{id}. The join payload must include display_name and may include password and host_token.

State model to plan: idle, prejoining, waiting-approval, joining, in-call, reconnecting, sfu-active, kicked, rejected, room-closed, media-error, and left.

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

Future tests: WebSocket join flow, approval room flow, host approve/reject, kick/mute messages, P2P signaling, SFU switch handling, chat/file events, and cleanup on leave.

*/

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  IceCandidatePayload,
  SessionDescriptionPayload
} from "@/features/meeting/types/signaling";
import {
  addLocalTracks,
  closePeerConnection,
  createPeerConnection,
  payloadToIceCandidate,
  payloadToSessionDescription,
  sessionDescriptionToPayload
} from "@/lib/webrtc/PeerConnectionFactory";

export function usePeerConnection({
  localStream,
  onAnswer,
  onIceCandidate,
  onOffer,
  peerId
}: {
  localStream: MediaStream | null;
  onAnswer: (peerId: string, payload: SessionDescriptionPayload) => void;
  onIceCandidate: (peerId: string, payload: IceCandidatePayload) => void;
  onOffer: (peerId: string, payload: SessionDescriptionPayload) => void;
  peerId: string;
}) {
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const ensureConnection = useCallback(() => {
    if (connectionRef.current) {
      return connectionRef.current;
    }

    const connection = createPeerConnection({
      onIceCandidate: (candidate) => onIceCandidate(peerId, candidate),
      onTrack: (event) => setRemoteStream(event.streams[0] ?? null)
    });

    if (localStream) {
      addLocalTracks(connection, localStream);
    }

    connectionRef.current = connection;
    return connection;
  }, [localStream, onIceCandidate, peerId]);

  const createOffer = useCallback(async () => {
    const connection = ensureConnection();
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    onOffer(peerId, sessionDescriptionToPayload(offer));
  }, [ensureConnection, onOffer, peerId]);

  const acceptOffer = useCallback(
    async (payload: SessionDescriptionPayload) => {
      const connection = ensureConnection();
      await connection.setRemoteDescription(
        payloadToSessionDescription("offer", payload)
      );
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      onAnswer(peerId, sessionDescriptionToPayload(answer));
    },
    [ensureConnection, onAnswer, peerId]
  );

  const acceptAnswer = useCallback(
    async (payload: SessionDescriptionPayload) => {
      await ensureConnection().setRemoteDescription(
        payloadToSessionDescription("answer", payload)
      );
    },
    [ensureConnection]
  );

  const addIceCandidate = useCallback(
    async (payload: IceCandidatePayload) => {
      await ensureConnection().addIceCandidate(payloadToIceCandidate(payload));
    },
    [ensureConnection]
  );

  const close = useCallback(() => {
    closePeerConnection(connectionRef.current);
    connectionRef.current = null;
    setRemoteStream(null);
  }, []);

  useEffect(() => {
    const connection = connectionRef.current;

    if (!connection || !localStream) {
      return;
    }

    addLocalTracks(connection, localStream);
  }, [localStream]);

  useEffect(() => close, [close]);

  return {
    acceptAnswer,
    acceptOffer,
    addIceCandidate,
    close,
    connection: connectionRef.current,
    createOffer,
    remoteStream
  };
}
