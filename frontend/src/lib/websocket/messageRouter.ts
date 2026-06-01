/*
Frontend architecture note

File: src\lib\websocket\messageRouter.ts
Layer: WebSocket Infrastructure

Responsibility:
- Type-aware WebSocket message dispatcher that routes signaling, chat, file, moderation, SFU, and lifecycle messages to feature handlers.

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

import type { IncomingSignalMessage } from "@/features/meeting/types/signaling";

export type SignalMessageHandler<
  TMessage extends IncomingSignalMessage = IncomingSignalMessage
> = (message: TMessage) => Promise<void> | void;

export class MessageRouter {
  private readonly handlers = new Map<string, Set<SignalMessageHandler>>();
  private readonly wildcardHandlers = new Set<SignalMessageHandler>();

  subscribe<TType extends IncomingSignalMessage["type"]>(
    type: TType,
    handler: SignalMessageHandler<
      Extract<IncomingSignalMessage, { type: TType }>
    >
  ) {
    const handlers = this.handlers.get(type) ?? new Set<SignalMessageHandler>();
    handlers.add(handler as SignalMessageHandler);
    this.handlers.set(type, handlers);

    return () => {
      handlers.delete(handler as SignalMessageHandler);
    };
  }

  subscribeAll(handler: SignalMessageHandler) {
    this.wildcardHandlers.add(handler);
    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

  dispatch(message: IncomingSignalMessage) {
    this.handlers
      .get(message.type)
      ?.forEach((handler) => this.dispatchToHandler(handler, message));
    this.wildcardHandlers.forEach((handler) =>
      this.dispatchToHandler(handler, message)
    );
  }

  private dispatchToHandler(
    handler: SignalMessageHandler,
    message: IncomingSignalMessage
  ) {
    try {
      const result = handler(message);

      if (result instanceof Promise) {
        result.catch(() => undefined);
      }
    } catch {
      // Individual signaling failures should not crash the meeting route.
    }
  }
}

export function parseSignalMessage(raw: string) {
  const parsed = JSON.parse(raw) as IncomingSignalMessage;

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof parsed.type !== "string"
  ) {
    throw new Error("Invalid WebSocket message");
  }

  return parsed;
}
