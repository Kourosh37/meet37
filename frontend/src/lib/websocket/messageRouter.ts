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
    } catch (error) {
      void error;
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
