"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TurnServerConfig } from "@/features/meeting/types/signaling";
import { SFUClient } from "@/lib/webrtc/SFUClient";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

interface UseSFUConnectionOptions {
  enabled?: boolean;
  turnServers?: TurnServerConfig[];
}

export function useSFUConnection(
  localStream: MediaStream | null,
  options: UseSFUConnectionOptions = {}
) {
  const { enabled = false, turnServers = [] } = options;
  const clientRef = useRef<SFUClient | null>(null);
  const localStreamRef = useRef(localStream);
  const remoteStreamRefs = useRef(new Map<string, MediaStream>());
  const pendingTracksRef = useRef(new Map<string, MediaStreamTrack>());
  const startedRef = useRef(false);
  const streamOwnersRef = useRef(new Map<string, string>());
  const trackOwnersRef = useRef(new Map<string, string>());
  const [connections, setConnections] = useState(
    () => new Map<string, RTCPeerConnection>()
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  const publishConnection = useCallback(() => {
    const connection = clientRef.current?.getConnection();
    setConnections(
      connection
        ? new Map([["sfu", connection]])
        : new Map<string, RTCPeerConnection>()
    );
  }, []);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const publishOwnerTrack = useCallback(
    (ownerId: string, track: MediaStreamTrack) => {
      const ownerStream =
        remoteStreamRefs.current.get(ownerId) ?? new MediaStream();

      if (!remoteStreamRefs.current.has(ownerId)) {
        remoteStreamRefs.current.set(ownerId, ownerStream);
      }

      ownerStream.getTracks().forEach((existing) => {
        if (existing.kind === track.kind && existing.id !== track.id) {
          ownerStream.removeTrack(existing);
        }
      });

      if (
        !ownerStream.getTracks().some((existing) => existing.id === track.id)
      ) {
        ownerStream.addTrack(track);
      }

      const publish = () => {
        setRemoteStreams((current) => ({
          ...current,
          [ownerId]: new MediaStream(ownerStream.getTracks())
        }));
      };

      track.addEventListener("ended", publish);
      track.addEventListener("mute", publish);
      track.addEventListener("unmute", publish);
      publish();
    },
    []
  );

  const publishPendingOwnerTracks = useCallback(
    (ownerId: string, trackId: string) => {
      const pending = pendingTracksRef.current.get(trackId);
      if (!pending) {
        return;
      }

      pendingTracksRef.current.delete(trackId);
      publishOwnerTrack(ownerId, pending);
    },
    [publishOwnerTrack]
  );

  const removeOwnerTracks = useCallback((ownerId: string) => {
    remoteStreamRefs.current.delete(ownerId);
    for (const [trackId, pending] of pendingTracksRef.current.entries()) {
      if (trackOwnersRef.current.get(trackId) === ownerId) {
        pendingTracksRef.current.delete(trackId);
        pending.stop();
      }
    }
    for (const [streamId, mappedOwner] of streamOwnersRef.current.entries()) {
      if (mappedOwner === ownerId) {
        streamOwnersRef.current.delete(streamId);
      }
    }
    for (const [trackId, mappedOwner] of trackOwnersRef.current.entries()) {
      if (mappedOwner === ownerId) {
        trackOwnersRef.current.delete(trackId);
      }
    }
    setRemoteStreams((current) => {
      if (!(ownerId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[ownerId];
      return next;
    });
  }, []);

  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new SFUClient({
        onIceCandidate: (payload) => {
          webSocketManager.send({ payload, type: "sfu-ice-candidate" });
        },
        onOffer: (payload) => {
          webSocketManager.send({ payload, type: "sfu-offer" });
        },
        onTrack: (event) => {
          const stream = event.streams[0];
          const ownerId =
            trackOwnersRef.current.get(event.track.id) ??
            (stream ? streamOwnersRef.current.get(stream.id) : undefined);

          if (ownerId) {
            publishOwnerTrack(ownerId, event.track);
            return;
          }

          if (stream) {
            pendingTracksRef.current.set(event.track.id, event.track);
          }
        }
      });
    }

    return clientRef.current;
  }, [publishOwnerTrack]);

  const startSFU = useCallback(
    async (servers: TurnServerConfig[] = turnServers) => {
      if (startedRef.current) {
        return;
      }

      startedRef.current = true;
      const offer = await getClient().start(localStreamRef.current, servers);
      publishConnection();
      if (offer) {
        webSocketManager.send({ payload: offer, type: "sfu-offer" });
      }
    },
    [getClient, publishConnection, turnServers]
  );

  useEffect(() => {
    const unsubscribers = [
      webSocketManager.subscribe("sfu-switch", async (message) => {
        setSessionId(message.payload.session_id);
        await startSFU(message.payload.turn_servers);
      }),
      webSocketManager.subscribe("sfu-answer", async (message) => {
        setSessionId(message.payload.session_id);
        const offer = await getClient().applyAnswer({
          sdp: message.payload.sdp
        });
        publishConnection();

        if (offer) {
          webSocketManager.send({ payload: offer, type: "sfu-offer" });
        }
      }),
      webSocketManager.subscribe("sfu-ice-candidate", async (message) => {
        await getClient().addIceCandidate(message.payload);
      }),
      webSocketManager.subscribe("sfu-renegotiate-needed", async (message) => {
        trackOwnersRef.current.set(
          message.payload.track_id,
          message.payload.owner_id
        );
        streamOwnersRef.current.set(
          message.payload.stream_id,
          message.payload.owner_id
        );
        publishPendingOwnerTracks(
          message.payload.owner_id,
          message.payload.track_id
        );
        const offer = await getClient().createOffer();
        publishConnection();
        if (offer) {
          webSocketManager.send({ payload: offer, type: "sfu-offer" });
        }
      }),
      webSocketManager.subscribe("peer-left", (message) => {
        removeOwnerTracks(message.payload.peer_id);
      })
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    getClient,
    publishConnection,
    publishPendingOwnerTracks,
    removeOwnerTracks,
    startSFU
  ]);

  useEffect(() => {
    if (!enabled) {
      clientRef.current?.close();
      remoteStreamRefs.current.clear();
      pendingTracksRef.current.clear();
      streamOwnersRef.current.clear();
      trackOwnersRef.current.clear();
      startedRef.current = false;
      setConnections(new Map());
      setSessionId(null);
      setRemoteStreams({});
      return;
    }

    void startSFU();
  }, [enabled, startSFU]);

  useEffect(() => {
    if (!enabled || !startedRef.current) {
      return;
    }

    void clientRef.current?.syncLocalStream(localStream).then((offer) => {
      publishConnection();
      if (offer) {
        webSocketManager.send({ payload: offer, type: "sfu-offer" });
      }
    });
  }, [enabled, localStream, publishConnection]);

  useEffect(
    () => () => {
      clientRef.current?.close();
      remoteStreamRefs.current.clear();
      pendingTracksRef.current.clear();
      startedRef.current = false;
      streamOwnersRef.current.clear();
      trackOwnersRef.current.clear();
    },
    []
  );

  return {
    active: enabled && startedRef.current,
    connections,
    remoteStreams,
    sessionId
  };
}
