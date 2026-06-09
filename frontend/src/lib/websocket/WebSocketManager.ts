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

export type ConnectionStatus =
  | "closed"
  | "connecting"
  | "open"
  | "reconnecting";
type ConnectionIDHandler = (connectionId: number) => void;
type StatusHandler = (status: ConnectionStatus) => void;

const wsLogger = createLogger("websocket");

export class WebSocketManager {
  private manuallyClosed = false;
  private queue: OutgoingSignalMessage[] = [];
  private connectionId = 0;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = "closed";
  private readonly router = new MessageRouter();
  private readonly connectionIdHandlers = new Set<ConnectionIDHandler>();
  private readonly statusHandlers = new Set<StatusHandler>();

  connect() {
    this.manuallyClosed = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    this.setStatus(this.socket ? "reconnecting" : "connecting");

    const url = new URL(publicEnv.NEXT_PUBLIC_WS_URL);
    const token = getAccessToken();

    if (token) {
      url.searchParams.set("token", token);
    }

    this.socket = new WebSocket(url.toString());
    this.socket.onopen = () => {
      this.connectionId += 1;
      this.connectionIdHandlers.forEach((handler) =>
        handler(this.connectionId)
      );
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
        this.queue = [];
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

  subscribeConnectionId(handler: ConnectionIDHandler) {
    this.connectionIdHandlers.add(handler);
    handler(this.connectionId);

    return () => {
      this.connectionIdHandlers.delete(handler);
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
