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
