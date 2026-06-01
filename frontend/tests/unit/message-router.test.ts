import type { IncomingSignalMessage } from "@/features/meeting/types/signaling";
import {
  MessageRouter,
  parseSignalMessage
} from "@/lib/websocket/messageRouter";
import { describe, expect, it, vi } from "vitest";

describe("MessageRouter", () => {
  it("dispatches typed and wildcard handlers", () => {
    const router = new MessageRouter();
    const joined = vi.fn();
    const all = vi.fn();
    const message: IncomingSignalMessage = {
      payload: {
        is_host: true,
        mode: "p2p",
        peers: [],
        your_id: "peer-1"
      },
      type: "joined"
    };

    router.subscribe("joined", joined);
    router.subscribeAll(all);
    router.dispatch(message);

    expect(joined).toHaveBeenCalledWith(message);
    expect(all).toHaveBeenCalledWith(message);
  });

  it("parses valid envelopes and rejects malformed data", () => {
    expect(parseSignalMessage(JSON.stringify({ type: "room-closed" }))).toEqual(
      {
        type: "room-closed"
      }
    );
    expect(() => parseSignalMessage("{}")).toThrow("Invalid WebSocket message");
  });
});
