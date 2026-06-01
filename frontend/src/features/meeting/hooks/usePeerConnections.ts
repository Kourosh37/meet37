/*
Frontend architecture note

File: src\features\meeting\hooks\usePeerConnections.ts
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
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
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
  sessionDescriptionToPayload,
  syncLocalTracks
} from "@/lib/webrtc/PeerConnectionFactory";
import { dataChannelRegistry } from "@/lib/webrtc/DataChannelRegistry";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

const FILE_TRANSFER_CHANNEL = "file-transfer";

function isConnectionUsable(connection: RTCPeerConnection) {
  return !["closed", "failed"].includes(connection.connectionState);
}

export function usePeerConnections(localStream: MediaStream | null) {
  const peers = useMeetingStore((state) => state.peers);
  const localPeerId = useMeetingStore((state) => state.localPeerId);
  const connections = useRef(new Map<string, RTCPeerConnection>());
  const ignoredOfferPeerIds = useRef(new Set<string>());
  const makingOfferPeerIds = useRef(new Set<string>());
  const offeredPeerIds = useRef(new Set<string>());
  const pendingNegotiationPeerIds = useRef(new Set<string>());
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  const sendDescription = useCallback(
    (
      type: "answer" | "offer",
      peerId: string,
      payload: SessionDescriptionPayload
    ) => {
      webSocketManager.send({ payload, to: peerId, type });
    },
    []
  );

  const sendIceCandidate = useCallback(
    (peerId: string, payload: IceCandidatePayload) => {
      webSocketManager.send({ payload, to: peerId, type: "ice-candidate" });
    },
    []
  );

  const flushNegotiation = useCallback(
    async (peerId: string) => {
      const connection = connections.current.get(peerId);

      if (!connection || !isConnectionUsable(connection)) {
        pendingNegotiationPeerIds.current.delete(peerId);
        return;
      }

      if (
        makingOfferPeerIds.current.has(peerId) ||
        connection.signalingState !== "stable"
      ) {
        window.setTimeout(() => {
          void flushNegotiation(peerId);
        }, 200);
        return;
      }

      pendingNegotiationPeerIds.current.delete(peerId);
      makingOfferPeerIds.current.add(peerId);

      try {
        const offer = await connection.createOffer();

        if (connection.signalingState !== "stable") {
          pendingNegotiationPeerIds.current.add(peerId);
          return;
        }

        await connection.setLocalDescription(offer);
        sendDescription("offer", peerId, sessionDescriptionToPayload(offer));
      } catch {
        pendingNegotiationPeerIds.current.add(peerId);
      } finally {
        makingOfferPeerIds.current.delete(peerId);

        if (pendingNegotiationPeerIds.current.has(peerId)) {
          window.setTimeout(() => {
            void flushNegotiation(peerId);
          }, 200);
        }
      }
    },
    [sendDescription]
  );

  const requestNegotiation = useCallback(
    (peerId: string) => {
      pendingNegotiationPeerIds.current.add(peerId);
      void flushNegotiation(peerId);
    },
    [flushNegotiation]
  );

  const ensureConnection = useCallback(
    (peerId: string) => {
      const existing = connections.current.get(peerId);

      if (existing) {
        return existing;
      }

      const connection = createPeerConnection({
        onDataChannel: (event) => {
          if (event.channel.label === FILE_TRANSFER_CHANNEL) {
            dataChannelRegistry.register(peerId, event.channel);
          }
        },
        onIceCandidate: (candidate) => sendIceCandidate(peerId, candidate),
        onTrack: (event) => {
          const stream = event.streams[0];

          if (stream) {
            setRemoteStreams((current) => ({ ...current, [peerId]: stream }));
          }
        }
      });
      connection.onnegotiationneeded = () => requestNegotiation(peerId);

      if (localStream) {
        void addLocalTracks(connection, localStream);
      }

      const channel = connection.createDataChannel(FILE_TRANSFER_CHANNEL, {
        ordered: true
      });
      dataChannelRegistry.register(peerId, channel);

      connections.current.set(peerId, connection);
      return connection;
    },
    [localStream, requestNegotiation, sendIceCandidate]
  );

  useEffect(() => {
    Object.keys(peers).forEach((peerId) => {
      if (!localPeerId || localPeerId > peerId) {
        return;
      }

      if (offeredPeerIds.current.has(peerId)) {
        return;
      }

      offeredPeerIds.current.add(peerId);
      ensureConnection(peerId);
      requestNegotiation(peerId);
    });
  }, [ensureConnection, localPeerId, peers, requestNegotiation]);

  useEffect(() => {
    if (!localStream) {
      return;
    }

    connections.current.forEach((connection, peerId) => {
      if (!isConnectionUsable(connection)) {
        return;
      }

      void syncLocalTracks(connection, localStream).then(() => {
        requestNegotiation(peerId);
      });
    });
  }, [localStream, requestNegotiation]);

  useEffect(() => {
    const peerIds = new Set(Object.keys(peers));

    connections.current.forEach((connection, peerId) => {
      if (peerIds.has(peerId)) {
        return;
      }

      closePeerConnection(connection);
      dataChannelRegistry.unregister(peerId);
      connections.current.delete(peerId);
      ignoredOfferPeerIds.current.delete(peerId);
      makingOfferPeerIds.current.delete(peerId);
      offeredPeerIds.current.delete(peerId);
      pendingNegotiationPeerIds.current.delete(peerId);
      setRemoteStreams((current) => {
        const { [peerId]: _removed, ...next } = current;
        return next;
      });
    });
  }, [peers]);

  useEffect(() => {
    const unsubscribers = [
      webSocketManager.subscribe("offer", async (message) => {
        if (!message.from) {
          return;
        }

        const connection = ensureConnection(message.from);
        if (!isConnectionUsable(connection)) {
          return;
        }
        const offerCollision =
          makingOfferPeerIds.current.has(message.from) ||
          connection.signalingState !== "stable";
        const currentLocalPeerId = localPeerId;
        const polite =
          currentLocalPeerId !== null && currentLocalPeerId > message.from;

        ignoredOfferPeerIds.current.delete(message.from);

        if (offerCollision) {
          if (!polite) {
            ignoredOfferPeerIds.current.add(message.from);
            return;
          }

          await connection.setLocalDescription({ type: "rollback" });
        }

        await connection.setRemoteDescription(
          payloadToSessionDescription("offer", message.payload)
        );
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        sendDescription(
          "answer",
          message.from,
          sessionDescriptionToPayload(answer)
        );
      }),
      webSocketManager.subscribe("answer", async (message) => {
        if (message.from) {
          const connection = ensureConnection(message.from);
          if (
            !isConnectionUsable(connection) ||
            connection.signalingState === "stable"
          ) {
            return;
          }
          await connection.setRemoteDescription(
            payloadToSessionDescription("answer", message.payload)
          );
        }
      }),
      webSocketManager.subscribe("ice-candidate", async (message) => {
        if (message.from) {
          if (ignoredOfferPeerIds.current.has(message.from)) {
            return;
          }

          const connection = ensureConnection(message.from);
          if (
            !isConnectionUsable(connection) ||
            !connection.remoteDescription
          ) {
            return;
          }
          await connection.addIceCandidate(
            payloadToIceCandidate(message.payload)
          );
        }
      })
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [ensureConnection, localPeerId, sendDescription]);

  useEffect(
    () => () => {
      connections.current.forEach(closePeerConnection);
      connections.current.forEach((_connection, peerId) =>
        dataChannelRegistry.unregister(peerId)
      );
      connections.current.clear();
    },
    []
  );

  return {
    connections: connections.current,
    remoteStreams
  };
}
