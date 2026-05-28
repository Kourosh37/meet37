"use client";

import { useEffect, useRef, useState } from "react";
import { SFUClient } from "@/lib/webrtc/SFUClient";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

export function useSFUConnection(localStream: MediaStream | null) {
  const clientRef = useRef<SFUClient | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const getClient = () => {
      if (!clientRef.current) {
        clientRef.current = new SFUClient({
          onIceCandidate: (payload) => {
            webSocketManager.send({ payload, type: "sfu-ice-candidate" });
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
        webSocketManager.send({ payload: offer, type: "sfu-offer" });
      }),
      webSocketManager.subscribe("sfu-answer", async (message) => {
        setSessionId(message.payload.session_id);
        await getClient().applyAnswer({ sdp: message.payload.sdp });
      }),
      webSocketManager.subscribe("sfu-ice-candidate", async (message) => {
        await getClient().addIceCandidate(message.payload);
      }),
      webSocketManager.subscribe("sfu-renegotiate-needed", async () => {
        const offer = await getClient().createOffer();
        webSocketManager.send({ payload: offer, type: "sfu-offer" });
      })
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [localStream]);

  useEffect(
    () => () => {
      clientRef.current?.close();
    },
    []
  );

  return {
    active: Boolean(sessionId),
    sessionId
  };
}
