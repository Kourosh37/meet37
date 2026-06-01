"use client";

import { useEffect, useRef, useState } from "react";
import { SFUClient } from "@/lib/webrtc/SFUClient";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

export function useSFUConnection(localStream: MediaStream | null) {
  const clientRef = useRef<SFUClient | null>(null);
  const remoteStreamRefs = useRef(new Map<string, MediaStream>());
  const streamOwnersRef = useRef(new Map<string, string>());
  const trackOwnersRef = useRef(new Map<string, string>());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  useEffect(() => {
    const getClient = () => {
      if (!clientRef.current) {
        clientRef.current = new SFUClient({
          onIceCandidate: (payload) => {
            webSocketManager.send({ payload, type: "sfu-ice-candidate" });
          },
          onTrack: (event) => {
            const stream = event.streams[0];
            const ownerId =
              trackOwnersRef.current.get(event.track.id) ??
              (stream ? streamOwnersRef.current.get(stream.id) : undefined);

            if (ownerId) {
              const ownerStream =
                remoteStreamRefs.current.get(ownerId) ??
                stream ??
                new MediaStream();

              if (!remoteStreamRefs.current.has(ownerId)) {
                remoteStreamRefs.current.set(ownerId, ownerStream);
              }

              if (
                !ownerStream
                  .getTracks()
                  .some((track) => track.id === event.track.id)
              ) {
                ownerStream.addTrack(event.track);
              }

              setRemoteStreams((current) => ({
                ...current,
                [ownerId]: ownerStream
              }));
              return;
            }

            if (stream) {
              setRemoteStreams((current) => ({
                ...current,
                [stream.id]: stream
              }));
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
