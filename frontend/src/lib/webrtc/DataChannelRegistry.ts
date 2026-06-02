type DataChannelMessageHandler = (event: {
  data: MessageEvent["data"];
  peerId: string;
}) => void;

export class DataChannelRegistry {
  private readonly channels = new Map<string, RTCDataChannel>();
  private readonly handlers = new Set<DataChannelMessageHandler>();
  private readonly waiters = new Map<
    string,
    Set<(channel: RTCDataChannel) => void>
  >();

  register(peerId: string, channel: RTCDataChannel) {
    channel.binaryType = "arraybuffer";
    this.channels.set(peerId, channel);
    this.waiters.get(peerId)?.forEach((resolve) => resolve(channel));
    this.waiters.delete(peerId);

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

  get(peerId: string) {
    return this.channels.get(peerId) ?? null;
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

  waitUntilRegistered(peerId: string, timeoutMs = 15_000) {
    const channel = this.channels.get(peerId);

    if (channel) {
      return Promise.resolve(channel);
    }

    return new Promise<RTCDataChannel>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("File transfer channel is not available"));
      }, timeoutMs);

      const handleRegistered = (registeredChannel: RTCDataChannel) => {
        cleanup();
        resolve(registeredChannel);
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        const waiters = this.waiters.get(peerId);
        waiters?.delete(handleRegistered);
        if (waiters?.size === 0) {
          this.waiters.delete(peerId);
        }
      };

      const waiters = this.waiters.get(peerId) ?? new Set();
      waiters.add(handleRegistered);
      this.waiters.set(peerId, waiters);
    });
  }

  waitUntilOpen(peerId: string, timeoutMs = 15_000) {
    return this.waitUntilRegistered(peerId, timeoutMs).then(
      (channel) =>
        new Promise<void>((resolve, reject) => {
          if (channel.readyState === "open") {
            resolve();
            return;
          }

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
        })
    );
  }

  waitForBufferedAmount(peerId: string, threshold = 512 * 1024) {
    const channel = this.channels.get(peerId);

    if (!channel || channel.readyState !== "open") {
      return Promise.reject(new Error("File transfer channel is not open"));
    }

    if (channel.bufferedAmount <= threshold) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      channel.bufferedAmountLowThreshold = threshold;

      const handleLow = () => {
        cleanup();
        resolve();
      };
      const handleClose = () => {
        cleanup();
        reject(new Error("File transfer channel closed"));
      };
      const cleanup = () => {
        channel.removeEventListener("bufferedamountlow", handleLow);
        channel.removeEventListener("close", handleClose);
      };

      channel.addEventListener("bufferedamountlow", handleLow);
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
