"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import type {
  IceCandidatePayload,
  SessionDescriptionPayload
} from "@/features/meeting/types/signaling";
import {
  addLocalTracks,
  buildIceServers,
  closePeerConnection,
  createPeerConnection,
  ensureRecvTransceivers,
  payloadToIceCandidate,
  payloadToSessionDescription,
  sessionDescriptionToPayload,
  syncLocalTracks
} from "@/lib/webrtc/PeerConnectionFactory";
import { dataChannelRegistry } from "@/lib/webrtc/DataChannelRegistry";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

const FILE_TRANSFER_CHANNEL = "file-transfer";
const ICE_RECOVERY_DELAY_MS = 900;
const MEDIA_WATCHDOG_INTERVAL_MS = 2_500;
const MEDIA_RECOVERY_COOLDOWN_MS = 4_000;

function isConnectionUsable(connection: RTCPeerConnection) {
  return connection.connectionState !== "closed";
}

function hasLiveTrack(
  stream: MediaStream | undefined,
  kind: MediaStreamTrack["kind"]
) {
  return Boolean(
    stream
      ?.getTracks()
      .some((track) => track.kind === kind && track.readyState === "live")
  );
}

function safelyRestartIce(connection: RTCPeerConnection) {
  try {
    connection.restartIce?.();
  } catch {
    return;
  }
}

function safelySetIceServers(
  connection: RTCPeerConnection,
  iceServers: RTCIceServer[]
) {
  try {
    connection.setConfiguration({ iceServers });
  } catch {
    return;
  }
}

export function usePeerConnections(localStream: MediaStream | null) {
  const peers = useMeetingStore((state) => state.peers);
  const localPeerId = useMeetingStore((state) => state.localPeerId);
  const turnServers = useMeetingStore((state) => state.turnServers);
  const connections = useRef(new Map<string, RTCPeerConnection>());
  const ignoredOfferPeerIds = useRef(new Set<string>());
  const makingOfferPeerIds = useRef(new Set<string>());
  const offeredPeerIds = useRef(new Set<string>());
  const pendingIceCandidates = useRef(new Map<string, IceCandidatePayload[]>());
  const pendingNegotiationPeerIds = useRef(new Set<string>());
  const iceRecoveryTimers = useRef(new Map<string, number>());
  const lastMediaRecoveryAt = useRef(new Map<string, number>());
  const remoteStreamRefs = useRef(new Map<string, MediaStream>());
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  const getCurrentTurnServers = useCallback(() => {
    const latestTurnServers = useMeetingStore.getState().turnServers;
    if (latestTurnServers?.length) {
      return latestTurnServers;
    }

    return turnServers?.length ? turnServers : undefined;
  }, [turnServers]);

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

  const recoverConnection = useCallback(
    (peerId: string, delay = ICE_RECOVERY_DELAY_MS) => {
      const existingTimer = iceRecoveryTimers.current.get(peerId);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      const timer = window.setTimeout(() => {
        iceRecoveryTimers.current.delete(peerId);
        const connection = connections.current.get(peerId);
        if (!connection || !isConnectionUsable(connection)) {
          return;
        }

        const latestTurnServers = getCurrentTurnServers();
        if (latestTurnServers?.length) {
          safelySetIceServers(connection, buildIceServers(latestTurnServers));
        }

        safelyRestartIce(connection);
        requestNegotiation(peerId);
      }, delay);

      iceRecoveryTimers.current.set(peerId, timer);
    },
    [getCurrentTurnServers, requestNegotiation]
  );

  const flushQueuedIceCandidates = useCallback(async (peerId: string) => {
    const connection = connections.current.get(peerId);
    const queued = pendingIceCandidates.current.get(peerId) ?? [];

    if (!connection || !connection.remoteDescription || queued.length === 0) {
      return;
    }

    pendingIceCandidates.current.delete(peerId);
    for (const payload of queued) {
      await connection
        .addIceCandidate(payloadToIceCandidate(payload))
        .catch(() => undefined);
    }
  }, []);

  const upsertRemoteTrack = useCallback(
    (peerId: string, event: RTCTrackEvent) => {
      const nextStream =
        remoteStreamRefs.current.get(peerId) ??
        event.streams[0] ??
        new MediaStream();

      if (!remoteStreamRefs.current.has(peerId)) {
        remoteStreamRefs.current.set(peerId, nextStream);
      }

      if (
        !nextStream.getTracks().some((track) => track.id === event.track.id)
      ) {
        nextStream.addTrack(event.track);
      }

      const publish = () => {
        setRemoteStreams((current) => ({
          ...current,
          [peerId]: new MediaStream(nextStream.getTracks())
        }));
      };

      event.track.addEventListener("ended", publish);
      event.track.addEventListener("mute", publish);
      event.track.addEventListener("unmute", publish);
      publish();
    },
    []
  );

  const ensureConnection = useCallback(
    (peerId: string) => {
      const existing = connections.current.get(peerId);

      if (existing) {
        return existing;
      }

      let connection: RTCPeerConnection;

      try {
        connection = createPeerConnection({
          iceServers: getCurrentTurnServers(),
          onDataChannel: (event) => {
            if (event.channel.label === FILE_TRANSFER_CHANNEL) {
              dataChannelRegistry.register(peerId, event.channel);
            }
          },
          onIceCandidate: (candidate) => sendIceCandidate(peerId, candidate),
          onTrack: (event) => upsertRemoteTrack(peerId, event)
        });
      } catch {
        return null;
      }
      ensureRecvTransceivers(connection, { audio: 1, video: 1 });
      connection.onnegotiationneeded = () => requestNegotiation(peerId);
      const handleConnectionRecovery = () => {
        if (
          connection.iceConnectionState === "failed" ||
          connection.iceConnectionState === "disconnected" ||
          connection.connectionState === "failed" ||
          connection.connectionState === "disconnected"
        ) {
          recoverConnection(
            peerId,
            connection.iceConnectionState === "failed" ||
              connection.connectionState === "failed"
              ? 0
              : ICE_RECOVERY_DELAY_MS
          );
        }
      };
      connection.oniceconnectionstatechange = handleConnectionRecovery;
      connection.onconnectionstatechange = handleConnectionRecovery;

      if (localStream) {
        void addLocalTracks(connection, localStream);
      }

      try {
        const channel = connection.createDataChannel(FILE_TRANSFER_CHANNEL, {
          ordered: true
        });
        dataChannelRegistry.register(peerId, channel);
      } catch {
        dataChannelRegistry.unregister(peerId);
      }

      connections.current.set(peerId, connection);
      return connection;
    },
    [
      localStream,
      getCurrentTurnServers,
      requestNegotiation,
      recoverConnection,
      sendIceCandidate,
      upsertRemoteTrack
    ]
  );

  const addOrQueueIceCandidate = useCallback(
    async (peerId: string, payload: IceCandidatePayload) => {
      const connection = ensureConnection(peerId);

      if (ignoredOfferPeerIds.current.has(peerId)) {
        return;
      }

      if (!connection || !isConnectionUsable(connection) || !connection.remoteDescription) {
        const queued = pendingIceCandidates.current.get(peerId) ?? [];
        queued.push(payload);
        pendingIceCandidates.current.set(peerId, queued);
        return;
      }

      await connection
        .addIceCandidate(payloadToIceCandidate(payload))
        .catch(() => undefined);
    },
    [ensureConnection]
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
    connections.current.forEach((connection, peerId) => {
      if (!isConnectionUsable(connection)) {
        return;
      }

      void syncLocalTracks(connection, localStream).then(() => {
        requestNegotiation(peerId);
      });
    });
  }, [localStream, peers, requestNegotiation]);

  useEffect(() => {
    const latestTurnServers = getCurrentTurnServers();

    if (!latestTurnServers?.length) {
      return;
    }

    connections.current.forEach((connection, peerId) => {
      if (!isConnectionUsable(connection)) {
        return;
      }

      safelySetIceServers(connection, buildIceServers(latestTurnServers));
      safelyRestartIce(connection);
      requestNegotiation(peerId);
    });
  }, [getCurrentTurnServers, requestNegotiation]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();

      Object.entries(peers).forEach(([peerId, peer]) => {
        const stream = remoteStreams[peerId];
        const expectsAudio =
          peer.media.audioEnabled && peer.media.audioStatus !== "off";
        const expectsVideo =
          (peer.media.videoEnabled && peer.media.videoStatus !== "off") ||
          (peer.media.screenSharing && peer.media.screenShareStatus !== "off");
        const missingExpectedAudio = expectsAudio && !hasLiveTrack(stream, "audio");
        const missingExpectedVideo = expectsVideo && !hasLiveTrack(stream, "video");

        if (!missingExpectedAudio && !missingExpectedVideo) {
          return;
        }

        const lastRecoveryAt = lastMediaRecoveryAt.current.get(peerId) ?? 0;
        if (now - lastRecoveryAt < MEDIA_RECOVERY_COOLDOWN_MS) {
          return;
        }

        lastMediaRecoveryAt.current.set(peerId, now);
        ensureConnection(peerId);
        recoverConnection(peerId, 0);
      });
    }, MEDIA_WATCHDOG_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [ensureConnection, peers, recoverConnection, remoteStreams]);

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
      const recoveryTimer = iceRecoveryTimers.current.get(peerId);
      if (recoveryTimer) {
        window.clearTimeout(recoveryTimer);
      }
      iceRecoveryTimers.current.delete(peerId);
      lastMediaRecoveryAt.current.delete(peerId);
      remoteStreamRefs.current.delete(peerId);
      setRemoteStreams((current) => {
        const { [peerId]: _removed, ...next } = current;
        return next;
      });
      pendingIceCandidates.current.delete(peerId);
    });
  }, [peers]);

  useEffect(() => {
    const unsubscribers = [
      webSocketManager.subscribe("offer", async (message) => {
        if (!message.from) {
          return;
        }

        const connection = ensureConnection(message.from);
        if (!connection || !isConnectionUsable(connection)) {
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
        await flushQueuedIceCandidates(message.from);
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
            !connection ||
            !isConnectionUsable(connection) ||
            connection.signalingState === "stable"
          ) {
            return;
          }
          await connection.setRemoteDescription(
            payloadToSessionDescription("answer", message.payload)
          );
          await flushQueuedIceCandidates(message.from);
        }
      }),
      webSocketManager.subscribe("ice-candidate", async (message) => {
        if (message.from) {
          await addOrQueueIceCandidate(message.from, message.payload);
        }
      })
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    addOrQueueIceCandidate,
    ensureConnection,
    flushQueuedIceCandidates,
    localPeerId,
    sendDescription
  ]);

  useEffect(
    () => () => {
      connections.current.forEach(closePeerConnection);
      iceRecoveryTimers.current.forEach((timer) => window.clearTimeout(timer));
      iceRecoveryTimers.current.clear();
      lastMediaRecoveryAt.current.clear();
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
