"use client";

import { useEffect, useRef, useState } from "react";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

export function useWebSocketPing(isConnected: boolean) {
  const pendingPingsRef = useRef(new Map<string, number>());
  const [pingMs, setPingMs] = useState<number | null>(null);

  useEffect(() => {
    return webSocketManager.subscribe("pong", (message) => {
      const startedAt = pendingPingsRef.current.get(message.payload.id);

      if (startedAt === undefined) {
        return;
      }

      pendingPingsRef.current.delete(message.payload.id);
      setPingMs(Math.max(0, Math.round(performance.now() - startedAt)));
    });
  }, []);

  useEffect(() => {
    pendingPingsRef.current.clear();

    if (!isConnected) {
      setPingMs(null);
      return;
    }

    const sendPing = () => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      pendingPingsRef.current.set(id, performance.now());
      webSocketManager.send({ payload: { id }, type: "ping" });
    };

    sendPing();
    const interval = window.setInterval(sendPing, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isConnected]);

  return pingMs;
}
