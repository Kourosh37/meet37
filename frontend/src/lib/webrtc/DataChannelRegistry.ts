type DataChannelMessageHandler = (event: {
  data: MessageEvent["data"];
  peerId: string;
}) => void;

export class DataChannelRegistry {
  private readonly channels = new Map<string, RTCDataChannel>();
  private readonly handlers = new Set<DataChannelMessageHandler>();

  register(peerId: string, channel: RTCDataChannel) {
    channel.binaryType = "arraybuffer";
    this.channels.set(peerId, channel);

    channel.onmessage = (event) => {
      this.handlers.forEach((handler) => handler({ data: event.data, peerId }));
    };
    channel.onclose = () => {
      if (this.channels.get(peerId) === channel) {
        this.channels.delete(peerId);
      }
    };
  }

  unregister(peerId: string) {
    const channel = this.channels.get(peerId);
    channel?.close();
    this.channels.delete(peerId);
  }

  send(peerId: string, data: ArrayBuffer | string) {
    const channel = this.channels.get(peerId);

    if (channel?.readyState !== "open") {
      throw new Error("File transfer channel is not open");
    }

    if (typeof data === "string") {
      channel.send(data);
      return;
    }

    channel.send(data);
  }

  waitUntilOpen(peerId: string, timeoutMs = 15_000) {
    const channel = this.channels.get(peerId);

    if (!channel) {
      return Promise.reject(
        new Error("File transfer channel is not available")
      );
    }

    if (channel.readyState === "open") {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("File transfer channel did not open"));
      }, timeoutMs);

      const handleOpen = () => {
        cleanup();
        resolve();
      };
      const handleClose = () => {
        cleanup();
        reject(new Error("File transfer channel closed"));
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        channel.removeEventListener("open", handleOpen);
        channel.removeEventListener("close", handleClose);
      };

      channel.addEventListener("open", handleOpen);
      channel.addEventListener("close", handleClose);
    });
  }

  broadcast(data: ArrayBuffer | string) {
    this.channels.forEach((channel) => {
      if (channel.readyState === "open") {
        if (typeof data === "string") {
          channel.send(data);
          return;
        }

        channel.send(data);
      }
    });
  }

  subscribe(handler: DataChannelMessageHandler) {
    this.handlers.add(handler);

    return () => {
      this.handlers.delete(handler);
    };
  }
}

export const dataChannelRegistry = new DataChannelRegistry();
