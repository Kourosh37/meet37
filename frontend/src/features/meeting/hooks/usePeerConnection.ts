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
