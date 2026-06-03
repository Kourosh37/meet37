"use client";

import { useEffect, useRef, useState } from "react";
import { SFUClient } from "@/lib/webrtc/SFUClient";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

export function useSFUConnection(localStream: MediaStream | null) {
  const clientRef = useRef<SFUClient | null>(null);
  const remoteStreamRefs = useRef(new Map<string, MediaStream>());
  const pendingTracksRef = useRef(
    new Map<string, { stream: MediaStream; track: MediaStreamTrack }>()
  );
  const streamOwnersRef = useRef(new Map<string, string>());
  const trackOwnersRef = useRef(new Map<string, string>());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  useEffect(() => {
    const publishOwnerTrack = (
      ownerId: string,
      track: MediaStreamTrack,
      stream?: MediaStream
    ) => {
      const ownerStream =
        remoteStreamRefs.current.get(ownerId) ?? stream ?? new MediaStream();

      if (!remoteStreamRefs.current.has(ownerId)) {
        remoteStreamRefs.current.set(ownerId, ownerStream);
      }

      if (!ownerStream.getTracks().some((existing) => existing.id === track.id)) {
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
    };

    const publishPendingOwnerTracks = (ownerId: string, trackId: string) => {
      const pending = pendingTracksRef.current.get(trackId);
      if (!pending) {
        return;
      }

      pendingTracksRef.current.delete(trackId);
      publishOwnerTrack(ownerId, pending.track, pending.stream);
    };

    const getClient = () => {
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
              publishOwnerTrack(ownerId, event.track, stream);
              return;
            }

            if (stream) {
              pendingTracksRef.current.set(event.track.id, {
                stream,
                track: event.track
              });
            }
          }
        });
      }

      return clientRef.current;
    };

    const unsubscribers = [
      webSocketManager.subscribe("sfu-switch", async (message) => {
        setSessionId(message.payload.session_id);
        const offer = await getClient().start(
          localStream,
          message.payload.turn_servers
        );
        if (offer) {
          webSocketManager.send({ payload: offer, type: "sfu-offer" });
        }
      }),
      webSocketManager.subscribe("sfu-answer", async (message) => {
        setSessionId(message.payload.session_id);
        const offer = await getClient().applyAnswer({
          sdp: message.payload.sdp
        });

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
        if (offer) {
          webSocketManager.send({ payload: offer, type: "sfu-offer" });
        }
      })
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [localStream]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    void clientRef.current?.syncLocalStream(localStream).then((offer) => {
      if (offer) {
        webSocketManager.send({ payload: offer, type: "sfu-offer" });
      }
    });
  }, [localStream, sessionId]);

  useEffect(
    () => () => {
      clientRef.current?.close();
      remoteStreamRefs.current.clear();
      pendingTracksRef.current.clear();
      streamOwnersRef.current.clear();
      trackOwnersRef.current.clear();
    },
    []
  );

  return {
    active: Boolean(sessionId),
    remoteStreams,
    sessionId
  };
}
