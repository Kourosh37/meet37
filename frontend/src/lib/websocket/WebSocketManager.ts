/*
Frontend architecture note

File: src\lib\websocket\WebSocketManager.ts
Layer: WebSocket Infrastructure

Responsibility:
- Single WebSocket lifecycle manager for meeting signaling: connect, join, reconnect, send, receive, close, heartbeat, and listener subscription.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: message names, payload keys, host moderation events, chat events, file-transfer events, and sfu-switch must match backend/docs/WEBSOCKET.md exactly.

State model to plan: loading, ready, empty, recoverable error, fatal error, and cleanup/unmount behavior where applicable.

UX and edge cases to plan:
- Display clear loading and empty states instead of rendering nothing once implementation starts.
- Normalize backend errors into user-safe messages while preserving technical details for logger.ts.
- Keep room links shareable; never require global login just to open an existing meeting link.
- In private app mode, require login only for room creation, not for joining a shared room link.
- Every meeting participant must provide a non-empty display name before joining.

Security and privacy notes:
- Never expose refresh tokens to arbitrary components; use the storage/auth layer only.
- Treat host_token as room-scoped moderation authority and avoid leaking it into URLs or logs.
- Do not persist raw media streams, SDP blobs, ICE candidates, or file bytes unless a later backend feature explicitly requires it.

Future tests: success path, loading path, error path, accessibility expectations, and cleanup/side-effect boundaries.

*/

import type {
  IncomingSignalMessage,
  OutgoingSignalMessage
} from "@/features/meeting/types/signaling";
import { publicEnv } from "@/lib/env";
import { getAccessToken } from "@/lib/storage/tokenStorage";
import { createLogger } from "@/lib/utils/logger";
import {
  MessageRouter,
  parseSignalMessage,
  type SignalMessageHandler
} from "@/lib/websocket/messageRouter";

type ConnectionStatus = "closed" | "connecting" | "open" | "reconnecting";
type StatusHandler = (status: ConnectionStatus) => void;

const wsLogger = createLogger("websocket");

export class WebSocketManager {
  private manuallyClosed = false;
  private queue: OutgoingSignalMessage[] = [];
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = "closed";
  private readonly router = new MessageRouter();
  private readonly statusHandlers = new Set<StatusHandler>();

  connect() {
    this.manuallyClosed = false;
    this.setStatus(this.socket ? "reconnecting" : "connecting");

    const url = new URL(publicEnv.NEXT_PUBLIC_WS_URL);
    const token = getAccessToken();

    if (token) {
      url.searchParams.set("token", token);
    }

    this.socket = new WebSocket(url.toString());
    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus("open");
      this.flushQueue();
    };
    this.socket.onmessage = (event) => {
      try {
        this.router.dispatch(parseSignalMessage(String(event.data)));
      } catch (error) {
        wsLogger.warn("Failed to parse WebSocket message", { error });
      }
    };
    this.socket.onerror = () => {
      wsLogger.warn("WebSocket error");
    };
    this.socket.onclose = () => {
      this.socket = null;
      this.setStatus("closed");

      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    };
  }

  close() {
    this.manuallyClosed = true;
    this.queue = [];

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.socket?.close();
    this.socket = null;
    this.setStatus("closed");
  }

  send(message: OutgoingSignalMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return;
    }

    this.queue.push(message);
  }

  subscribe<TType extends IncomingSignalMessage["type"]>(
    type: TType,
    handler: SignalMessageHandler<
      Extract<IncomingSignalMessage, { type: TType }>
    >
  ) {
    return this.router.subscribe(type, handler);
  }

  subscribeAll(handler: SignalMessageHandler) {
    return this.router.subscribeAll(handler);
  }

  subscribeStatus(handler: StatusHandler) {
    this.statusHandlers.add(handler);
    handler(this.status);

    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  private flushQueue() {
    const queued = [...this.queue];
    this.queue = [];
    queued.forEach((message) => this.send(message));
  }

  private scheduleReconnect() {
    this.setStatus("reconnecting");
    const delay = Math.min(1_000 * 2 ** this.reconnectAttempt, 15_000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }
}

export const webSocketManager = new WebSocketManager();
