"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MeetingPeer } from "@/features/meeting/types/peer";
import type {
  IceCandidatePayload,
  SessionDescriptionPayload,
  TurnServerConfig
} from "@/features/meeting/types/signaling";
import {
  closePeerConnection,
  createPeerConnection,
  ensureRecvTransceivers,
  payloadToIceCandidate,
  payloadToSessionDescription,
  sessionDescriptionToPayload,
  syncLocalTracks
} from "@/lib/webrtc/PeerConnectionFactory";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

interface UseP2PConnectionsOptions {
  enabled?: boolean;
  localPeerId?: string | null;
  peers: Record<string, MeetingPeer>;
  turnServers?: TurnServerConfig[];
}

interface P2PEntry {
  connection: RTCPeerConnection;
  ignoreOffer: boolean;
  initialOfferSent: boolean;
  isSettingRemoteAnswerPending: boolean;
  iceRestartTimer: number | null;
  makingOffer: boolean;
  pendingOffer: boolean;
  pendingRestartIce: boolean;
  pendingIceCandidates: IceCandidatePayload[];
}

export function useP2PConnections(
  localStream: MediaStream | null,
  options: UseP2PConnectionsOptions
) {
  const {
    enabled = false,
    localPeerId,
    peers,
    turnServers = []
  } = options;
  const entriesRef = useRef(new Map<string, P2PEntry>());
  const localStreamRef = useRef(localStream);
  const remoteStreamRefs = useRef(new Map<string, MediaStream>());
  const [connections, setConnections] = useState(
    () => new Map<string, RTCPeerConnection>()
  );
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const publishConnections = useCallback(() => {
    setConnections(
      new Map(
        [...entriesRef.current.entries()].map(([peerId, entry]) => [
          peerId,
          entry.connection
        ])
      )
    );
  }, []);

  const publishRemoteStream = useCallback((peerId: string) => {
    const stream = remoteStreamRefs.current.get(peerId);
    setRemoteStreams((current) => {
      if (!stream) {
        if (!(peerId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[peerId];
        return next;
      }

      return {
        ...current,
        [peerId]: new MediaStream(stream.getTracks())
      };
    });
  }, []);

  const closePeer = useCallback(
    (peerId: string) => {
      const entry = entriesRef.current.get(peerId);
      if (entry) {
        if (entry.iceRestartTimer !== null) {
          window.clearTimeout(entry.iceRestartTimer);
        }
        closePeerConnection(entry.connection);
        entriesRef.current.delete(peerId);
        publishConnections();
      }
      remoteStreamRefs.current.delete(peerId);
      publishRemoteStream(peerId);
    },
    [publishConnections, publishRemoteStream]
  );

  const flushPendingIceCandidates = useCallback(async (entry: P2PEntry) => {
    if (!entry.connection.remoteDescription) {
      return;
    }

    const pending = [...entry.pendingIceCandidates];
    entry.pendingIceCandidates = [];
    for (const payload of pending) {
      await entry.connection
        .addIceCandidate(payloadToIceCandidate(payload))
        .catch(() => undefined);
    }
  }, []);

  const requestOffer = useCallback(
    async (peerId: string, options: { restartIce?: boolean } = {}) => {
      const entry = entriesRef.current.get(peerId);

      if (!entry) {
        return;
      }

      if (options.restartIce) {
        entry.pendingRestartIce = true;
      }

      if (entry.makingOffer || entry.connection.signalingState !== "stable") {
        entry.pendingOffer = true;
        return;
      }

      try {
        entry.makingOffer = true;
        entry.pendingOffer = false;
        await syncLocalTracks(entry.connection, localStreamRef.current, {
          reuseRecvOnly: true
        });
        const shouldRestartIce = entry.pendingRestartIce;
        const offer = await entry.connection.createOffer({
          iceRestart: shouldRestartIce
        });
        await entry.connection.setLocalDescription(offer);
        if (shouldRestartIce) {
          entry.pendingRestartIce = false;
        }
        webSocketManager.send({
          payload: sessionDescriptionToPayload(offer),
          to: peerId,
          type: "offer"
        });
        entry.initialOfferSent = true;
      } catch {
        entry.pendingOffer = true;
      } finally {
        entry.makingOffer = false;
      }
    },
    []
  );

  const getOrCreateEntry = useCallback(
    (peerId: string) => {
      const existing = entriesRef.current.get(peerId);
      if (existing) {
        return existing;
      }

      const connection = createPeerConnection({
        iceServers: turnServers,
        onIceCandidate: (payload) => {
          webSocketManager.send({ payload, to: peerId, type: "ice-candidate" });
        },
        onTrack: (event) => {
          const stream =
            remoteStreamRefs.current.get(peerId) ?? new MediaStream();
          remoteStreamRefs.current.set(peerId, stream);

          stream.getTracks().forEach((existingTrack) => {
            if (
              existingTrack.kind === event.track.kind &&
              existingTrack.id !== event.track.id
            ) {
              stream.removeTrack(existingTrack);
            }
          });

          if (!stream.getTracks().some((track) => track.id === event.track.id)) {
            stream.addTrack(event.track);
          }

          const publish = () => publishRemoteStream(peerId);
          event.track.addEventListener("ended", publish);
          event.track.addEventListener("mute", publish);
          event.track.addEventListener("unmute", publish);
          publish();
        }
      });
      ensureRecvTransceivers(connection, { audio: 1, video: 1 });
      const entry: P2PEntry = {
        connection,
        ignoreOffer: false,
        initialOfferSent: false,
        isSettingRemoteAnswerPending: false,
        iceRestartTimer: null,
        makingOffer: false,
        pendingOffer: false,
        pendingRestartIce: false,
        pendingIceCandidates: []
      };

      connection.onnegotiationneeded = () => {
        void requestOffer(peerId);
      };
      connection.onsignalingstatechange = () => {
        if (connection.signalingState !== "stable" || !entry.pendingOffer) {
          return;
        }

        void requestOffer(peerId);
      };
      connection.oniceconnectionstatechange = () => {
        if (
          !["disconnected", "failed"].includes(connection.iceConnectionState)
        ) {
          if (connection.iceConnectionState === "connected") {
            if (entry.iceRestartTimer !== null) {
              window.clearTimeout(entry.iceRestartTimer);
              entry.iceRestartTimer = null;
            }
            entry.pendingRestartIce = false;
          }
          return;
        }

        if (entry.iceRestartTimer !== null) {
          window.clearTimeout(entry.iceRestartTimer);
        }

        entry.iceRestartTimer = window.setTimeout(
          () => {
            entry.iceRestartTimer = null;
            if (
              connection.connectionState === "closed" ||
              connection.iceConnectionState === "closed"
            ) {
              return;
            }
            try {
              connection.restartIce();
            } catch {
              return;
            }
            void requestOffer(peerId, { restartIce: true });
          },
          connection.iceConnectionState === "failed" ? 0 : 1_500
        );
      };

      entriesRef.current.set(peerId, entry);
      publishConnections();
      void syncLocalTracks(connection, localStreamRef.current, {
        reuseRecvOnly: true
      });
      return entry;
    },
    [publishConnections, publishRemoteStream, requestOffer, turnServers]
  );

  const makeInitialOffer = useCallback(
    async (peerId: string) => {
      const entry = getOrCreateEntry(peerId);

      if (entry.initialOfferSent || entry.connection.signalingState !== "stable") {
        return;
      }

      await requestOffer(peerId);
    },
    [getOrCreateEntry, requestOffer]
  );

  const handleDescription = useCallback(
    async (
      type: "answer" | "offer",
      peerId: string,
      payload: SessionDescriptionPayload
    ) => {
      if (!enabled || !localPeerId) {
        return;
      }

      const entry = getOrCreateEntry(peerId);
      const connection = entry.connection;
      const polite = localPeerId > peerId;
      const readyForOffer =
        !entry.makingOffer &&
        (connection.signalingState === "stable" ||
          entry.isSettingRemoteAnswerPending);
      const offerCollision = type === "offer" && !readyForOffer;

      entry.ignoreOffer = !polite && offerCollision;
      if (entry.ignoreOffer) {
        return;
      }
      entry.ignoreOffer = false;

      try {
        entry.isSettingRemoteAnswerPending = type === "answer";
        await connection.setRemoteDescription(
          payloadToSessionDescription(type, payload)
        );
      } finally {
        entry.isSettingRemoteAnswerPending = false;
      }

      await flushPendingIceCandidates(entry);

      if (type === "offer") {
        await syncLocalTracks(connection, localStreamRef.current, {
          reuseRecvOnly: true
        });
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        webSocketManager.send({
          payload: sessionDescriptionToPayload(answer),
          to: peerId,
          type: "answer"
        });
      } else if (entry.pendingOffer) {
        void requestOffer(peerId);
      }
    },
    [
      enabled,
      flushPendingIceCandidates,
      getOrCreateEntry,
      localPeerId,
      requestOffer
    ]
  );

  useEffect(() => {
    const unsubscribers = [
      webSocketManager.subscribe("offer", (message) => {
        if (message.from) {
          void handleDescription("offer", message.from, message.payload);
        }
      }),
      webSocketManager.subscribe("answer", (message) => {
        if (message.from) {
          void handleDescription("answer", message.from, message.payload);
        }
      }),
      webSocketManager.subscribe("ice-candidate", (message) => {
        if (!enabled || !message.from) {
          return;
        }
        const entry = getOrCreateEntry(message.from);
        if (entry.ignoreOffer) {
          return;
        }
        if (!entry.connection.remoteDescription) {
          entry.pendingIceCandidates.push(message.payload);
          return;
        }
        void entry.connection
          .addIceCandidate(payloadToIceCandidate(message.payload))
          .catch(() => undefined);
      }),
      webSocketManager.subscribe("peer-left", (message) => {
        closePeer(message.payload.peer_id);
      })
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [closePeer, enabled, getOrCreateEntry, handleDescription]);

  useEffect(() => {
    if (!enabled || !localPeerId) {
      entriesRef.current.forEach((entry) => {
        if (entry.iceRestartTimer !== null) {
          window.clearTimeout(entry.iceRestartTimer);
        }
        closePeerConnection(entry.connection);
      });
      entriesRef.current.clear();
      remoteStreamRefs.current.clear();
      setConnections(new Map());
      setRemoteStreams({});
      return;
    }

    const activePeerIds = new Set(Object.keys(peers));
    for (const peerId of [...entriesRef.current.keys()]) {
      if (!activePeerIds.has(peerId)) {
        closePeer(peerId);
      }
    }

    for (const peerId of activePeerIds) {
      getOrCreateEntry(peerId);
      if (localPeerId < peerId) {
        void makeInitialOffer(peerId);
      }
    }
  }, [
    closePeer,
    enabled,
    getOrCreateEntry,
    localPeerId,
    makeInitialOffer,
    peers
  ]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    entriesRef.current.forEach((entry, peerId) => {
      void syncLocalTracks(entry.connection, localStream, {
        reuseRecvOnly: true
      }).then(() => {
        void requestOffer(peerId);
      });
    });
  }, [enabled, localStream, requestOffer]);

  useEffect(
    () => () => {
      entriesRef.current.forEach((entry) => {
        if (entry.iceRestartTimer !== null) {
          window.clearTimeout(entry.iceRestartTimer);
        }
        closePeerConnection(entry.connection);
      });
      entriesRef.current.clear();
      remoteStreamRefs.current.clear();
    },
    []
  );

  return {
    active: enabled && entriesRef.current.size > 0,
    connections,
    remoteStreams
  };
}
