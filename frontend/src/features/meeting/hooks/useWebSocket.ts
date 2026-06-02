"use client";

import { useEffect, useState } from "react";
import type { OutgoingSignalMessage } from "@/features/meeting/types/signaling";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

export function useWebSocket() {
  const [status, setStatus] = useState<
    "closed" | "connecting" | "open" | "reconnecting"
  >("closed");

  useEffect(() => webSocketManager.subscribeStatus(setStatus), []);

  return {
    close: () => webSocketManager.close(),
    connect: () => webSocketManager.connect(),
    isConnected: status === "open",
    send: (message: OutgoingSignalMessage) => webSocketManager.send(message),
    status
  };
}
