"use client";

import { useEffect, useState } from "react";
import type { OutgoingSignalMessage } from "@/features/meeting/types/signaling";
import {
  webSocketManager,
  type ConnectionStatus
} from "@/lib/websocket/WebSocketManager";

export function useWebSocket() {
  const [connectionId, setConnectionId] = useState(0);
  const [status, setStatus] = useState<ConnectionStatus>("closed");

  useEffect(() => webSocketManager.subscribeStatus(setStatus), []);
  useEffect(
    () => webSocketManager.subscribeConnectionId(setConnectionId),
    []
  );

  return {
    close: () => webSocketManager.close(),
    connect: () => webSocketManager.connect(),
    connectionId,
    isConnected: status === "open",
    send: (message: OutgoingSignalMessage) => webSocketManager.send(message),
    status
  };
}
