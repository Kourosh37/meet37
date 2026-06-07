"use client";

import { useEffect, useRef, useState } from "react";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

export function useWebSocketPing(isConnected: boolean) {
  const pendingPingsRef = useRef(new Map<string, number>());
  const [pingMs, setPingMs] = useState<number | null>(null);

  useEffect(() => {
    pendingPingsRef.current.clear();

    if (!isConnected) {
      setPingMs(null);
      return;
    }

    let timeout: number | undefined;
    let latestPing: number | null = null;

    const sendPing = () => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      pendingPingsRef.current.clear();
      pendingPingsRef.current.set(id, performance.now());
      webSocketManager.send({ payload: { id }, type: "ping" });
    };

    const schedulePing = () => {
      sendPing();
      timeout = window.setTimeout(
        schedulePing,
        latestPing === null ? 1000 : 5000
      );
    };

    const unsubscribe = webSocketManager.subscribe("pong", (message) => {
      const startedAt = pendingPingsRef.current.get(message.payload.id);

      if (startedAt === undefined) {
        return;
      }

      pendingPingsRef.current.delete(message.payload.id);
      latestPing = Math.max(0, Math.round(performance.now() - startedAt));
      setPingMs(latestPing);
    });

    schedulePing();

    return () => {
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
      unsubscribe();
    };
  }, [isConnected]);

  return pingMs;
}
