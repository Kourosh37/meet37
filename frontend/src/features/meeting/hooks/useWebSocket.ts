"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  const close = useCallback(() => webSocketManager.close(), []);
  const connect = useCallback(() => webSocketManager.connect(), []);
  const send = useCallback(
    (message: OutgoingSignalMessage) => webSocketManager.send(message),
    []
  );

  return useMemo(() => ({
    close,
    connect,
    connectionId,
    isConnected: status === "open",
    send,
    status
  }), [close, connect, connectionId, send, status]);
}
