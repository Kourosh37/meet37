"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { getRoomFiles } from "@/features/rooms/api/roomsApi";
import { useFileTransferStore } from "@/features/meeting/stores/fileTransferStore";
import type {
  FileChunk,
  FileTransferRecord
} from "@/features/meeting/types/file";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import { dataChannelRegistry } from "@/lib/webrtc/DataChannelRegistry";
import {
  assertFilePolicy,
  chunkBlob,
  reassembleChunks
} from "@/lib/utils/fileChunker";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

const OBJECT_URL_TTL_MS = 10 * 60 * 1000;

type FileChannelMessage =
  | {
      fileId: string;
      index: number;
      size: number;
      totalChunks: number;
      type: "file-chunk-meta";
    }
  | {
      fileId: string;
      mime: string;
      name: string;
      size: number;
      totalChunks: number;
      type: "file-start";
    }
  | {
      fileId: string;
      type: "file-complete";
    };

interface PendingChunkMeta {
  fileId: string;
  index: number;
  totalChunks: number;
}

interface ReceiveBuffer {
  chunks: FileChunk[];
  completed: boolean;
  mime: string;
  name: string;
  receivedBytes: number;
  size: number;
  totalChunks: number;
}

function parseChannelMessage(data: MessageEvent["data"]) {
  if (typeof data !== "string") {
    return null;
  }

  try {
    return JSON.parse(data) as FileChannelMessage;
  } catch {
    return null;
  }
}

function totalChunksFor(file: File) {
  return Math.ceil(file.size / (64 * 1024));
}

export function useFileTransfer(roomId: string | null) {
  const transfersById = useFileTransferStore((state) => state.transfers);
  const addOrUpdateTransfer = useFileTransferStore(
    (state) => state.addOrUpdateTransfer
  );
  const completeTransfer = useFileTransferStore(
    (state) => state.completeTransfer
  );
  const failTransfer = useFileTransferStore((state) => state.failTransfer);
  const loadHistory = useFileTransferStore((state) => state.loadHistory);
  const updateProgress = useFileTransferStore((state) => state.updateProgress);
  const updateStatus = useFileTransferStore((state) => state.updateStatus);
  const localPeerId = useMeetingStore((state) => state.localPeerId);
  const peers = useMeetingStore((state) => state.peers);
  const pendingChunkMeta = useRef(new Map<string, PendingChunkMeta>());
  const receiveBuffers = useRef(new Map<string, ReceiveBuffer>());
  const objectUrls = useRef(new Set<string>());
  const transfers = useMemo(
    () => Object.values(transfersById),
    [transfersById]
  );

  useEffect(() => {
    if (!roomId) {
      return;
    }

    let cancelled = false;

    getRoomFiles(roomId).then((history) => {
      if (!cancelled) {
        loadHistory(history);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadHistory, roomId]);

  const sendFileBytes = useCallback(
    async (fileId: string, peerId: string, file: File) => {
      try {
        await dataChannelRegistry.waitUntilOpen(peerId);
        dataChannelRegistry.send(
          peerId,
          JSON.stringify({
            fileId,
            mime: file.type || "application/octet-stream",
            name: file.name,
            size: file.size,
            totalChunks: totalChunksFor(file),
            type: "file-start"
          } satisfies FileChannelMessage)
        );

        let bytesTransferred = 0;

        for await (const chunk of chunkBlob(fileId, file)) {
          dataChannelRegistry.send(
            peerId,
            JSON.stringify({
              fileId,
              index: chunk.index,
              size: chunk.bytes.byteLength,
              totalChunks: chunk.totalChunks,
              type: "file-chunk-meta"
            } satisfies FileChannelMessage)
          );
          dataChannelRegistry.send(peerId, chunk.bytes);
          bytesTransferred += chunk.bytes.byteLength;
          updateProgress(fileId, bytesTransferred);
        }

        dataChannelRegistry.send(
          peerId,
          JSON.stringify({
            fileId,
            type: "file-complete"
          } satisfies FileChannelMessage)
        );
        const objectUrl = URL.createObjectURL(file);
        objectUrls.current.add(objectUrl);
        completeTransfer(fileId, objectUrl);
      } catch (error) {
        failTransfer(
          fileId,
          error instanceof Error ? error.message : "File transfer failed"
        );
      }
    },
    [completeTransfer, failTransfer, updateProgress]
  );

  const completeReceivedFile = useCallback(
    (fileId: string) => {
      const buffer = receiveBuffers.current.get(fileId);

      if (!buffer || buffer.completed) {
        return;
      }

      buffer.completed = true;
      const blob = reassembleChunks(buffer.chunks, buffer.mime);
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.current.add(objectUrl);
      completeTransfer(fileId, objectUrl);
      receiveBuffers.current.delete(fileId);
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        objectUrls.current.delete(objectUrl);
      }, OBJECT_URL_TTL_MS);
    },
    [completeTransfer]
  );

  useEffect(() => {
    const unsubscribers = [
      webSocketManager.subscribe("file-offer", (message) => {
        addOrUpdateTransfer({
          createdAt: Date.now(),
          direction: "incoming",
          fileId: message.payload.file_id,
          mime: message.payload.mime,
          name: message.payload.name,
          progress: {
            bytesTransferred: 0,
            fileId: message.payload.file_id,
            percentage: 0,
            totalBytes: message.payload.size
          },
          senderPeerId: message.from ?? "unknown",
          size: message.payload.size,
          status: "transferring",
          targetPeerId: localPeerId ?? ""
        });
      })
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [addOrUpdateTransfer, localPeerId]);

  useEffect(() => {
    return dataChannelRegistry.subscribe(({ data, peerId }) => {
      const message = parseChannelMessage(data);

      if (message?.type === "file-start") {
        receiveBuffers.current.set(message.fileId, {
          chunks: [],
          completed: false,
          mime: message.mime,
          name: message.name,
          receivedBytes: 0,
          size: message.size,
          totalChunks: message.totalChunks
        });
        updateStatus(message.fileId, "transferring");
        return;
      }

      if (message?.type === "file-chunk-meta") {
        pendingChunkMeta.current.set(peerId, {
          fileId: message.fileId,
          index: message.index,
          totalChunks: message.totalChunks
        });
        return;
      }

      if (message?.type === "file-complete") {
        completeReceivedFile(message.fileId);
        return;
      }

      if (data instanceof ArrayBuffer) {
        const meta = pendingChunkMeta.current.get(peerId);

        if (!meta) {
          return;
        }

        pendingChunkMeta.current.delete(peerId);
        const buffer = receiveBuffers.current.get(meta.fileId);

        if (!buffer) {
          return;
        }

        buffer.chunks.push({
          bytes: data,
          fileId: meta.fileId,
          index: meta.index,
          totalChunks: meta.totalChunks
        });
        buffer.receivedBytes += data.byteLength;
        updateProgress(meta.fileId, buffer.receivedBytes);

        if (
          buffer.chunks.length >= buffer.totalChunks ||
          buffer.receivedBytes >= buffer.size
        ) {
          completeReceivedFile(meta.fileId);
        }
      }
    });
  }, [completeReceivedFile, updateProgress, updateStatus]);

  useEffect(
    () => () => {
      objectUrls.current.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      objectUrls.current.clear();
    },
    []
  );

  const sendFile = useCallback(
    (file: File) => {
      try {
        assertFilePolicy(file);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "File is not allowed."
        );
        return;
      }

      const peerIds = Object.keys(peers);

      if (peerIds.length === 0) {
        toast.error("No participants available for file transfer.");
        return;
      }

      peerIds.forEach((peerId) => {
        const fileId = crypto.randomUUID();
        const transfer: FileTransferRecord = {
          createdAt: Date.now(),
          direction: "outgoing",
          fileId,
          mime: file.type || "application/octet-stream",
          name: file.name,
          progress: {
            bytesTransferred: 0,
            fileId,
            percentage: 0,
            totalBytes: file.size
          },
          senderPeerId: localPeerId ?? "",
          size: file.size,
          status: "transferring",
          targetPeerId: peerId
        };

        addOrUpdateTransfer(transfer);
        webSocketManager.send({
          payload: {
            file_id: fileId,
            mime: transfer.mime,
            name: file.name,
            size: file.size
          },
          to: peerId,
          type: "file-offer"
        });
        void sendFileBytes(fileId, peerId, file);
      });
    },
    [addOrUpdateTransfer, localPeerId, peers, sendFileBytes]
  );

  return {
    sendFile,
    transfers
  };
}
