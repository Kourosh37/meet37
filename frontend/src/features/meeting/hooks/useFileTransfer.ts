"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getRoomFiles } from "@/features/rooms/api/roomsApi";
import {
  listPersistentSharedFiles,
  savePersistentSharedFile
} from "@/features/meeting/lib/persistentFileShares";
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
const RECEIVE_IDLE_TIMEOUT_MS = 30_000;
const RESEND_DELAY_MS = 5_000;

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

interface SharedFileEntry {
  file: File;
  sentPeerIds: Set<string>;
  sendingPeerIds: Set<string>;
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
  const receiveTimeouts = useRef(new Map<string, number>());
  const sharedFiles = useRef(new Map<string, SharedFileEntry>());
  const restoredPersistentFileIds = useRef(new Set<string>());
  const objectUrls = useRef(new Set<string>());
  const [sharedFileVersion, setSharedFileVersion] = useState(0);
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
        webSocketManager.send({
          payload: {
            file_id: fileId,
            mime: file.type || "application/octet-stream",
            name: file.name,
            size: file.size
          },
          to: peerId,
          type: "file-offer"
        });
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
          await dataChannelRegistry.waitForBufferedAmount(peerId);
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
        throw error;
      }
    },
    [completeTransfer, failTransfer, updateProgress]
  );

  const sendSharedFileToPeer = useCallback(
    (sourceFileId: string, peerId: string) => {
      const sharedFile = sharedFiles.current.get(sourceFileId);

      if (
        !sharedFile ||
        sharedFile.sentPeerIds.has(peerId) ||
        sharedFile.sendingPeerIds.has(peerId)
      ) {
        return;
      }

      sharedFile.sendingPeerIds.add(peerId);
      const file = sharedFile.file;
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
      void sendFileBytes(fileId, peerId, file)
        .then(() => {
          sharedFile.sentPeerIds.add(peerId);
        })
        .catch(() => {
          window.setTimeout(() => {
            sendSharedFileToPeer(sourceFileId, peerId);
          }, RESEND_DELAY_MS);
        })
        .finally(() => {
          sharedFile.sendingPeerIds.delete(peerId);
        });
    },
    [addOrUpdateTransfer, localPeerId, sendFileBytes]
  );

  const clearReceiveTimeout = useCallback((fileId: string) => {
    const timeout = receiveTimeouts.current.get(fileId);

    if (timeout) {
      window.clearTimeout(timeout);
      receiveTimeouts.current.delete(fileId);
    }
  }, []);

  const refreshReceiveTimeout = useCallback(
    (fileId: string) => {
      clearReceiveTimeout(fileId);
      receiveTimeouts.current.set(
        fileId,
        window.setTimeout(() => {
          receiveTimeouts.current.delete(fileId);
          receiveBuffers.current.delete(fileId);
          failTransfer(fileId, "File transfer timed out.");
        }, RECEIVE_IDLE_TIMEOUT_MS)
      );
    },
    [clearReceiveTimeout, failTransfer]
  );

  const completeReceivedFile = useCallback(
    (fileId: string) => {
      const buffer = receiveBuffers.current.get(fileId);

      if (!buffer || buffer.completed) {
        return;
      }

      buffer.completed = true;
      clearReceiveTimeout(fileId);
      const blob = reassembleChunks(buffer.chunks, buffer.mime);
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.current.add(objectUrl);
      if (roomId) {
        void savePersistentSharedFile(
          roomId,
          fileId,
          blob,
          buffer.name,
          buffer.mime,
          "incoming"
        );
      }
      completeTransfer(fileId, objectUrl);
      receiveBuffers.current.delete(fileId);
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        objectUrls.current.delete(objectUrl);
      }, OBJECT_URL_TTL_MS);
    },
    [clearReceiveTimeout, completeTransfer, roomId]
  );

  useEffect(() => {
    const unsubscribers = [
      webSocketManager.subscribe("file-offer", (message) => {
        const existing =
          useFileTransferStore.getState().transfers[message.payload.file_id];

        if (existing) {
          return;
        }

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
        refreshReceiveTimeout(message.payload.file_id);
      })
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [addOrUpdateTransfer, localPeerId, refreshReceiveTimeout]);

  useEffect(() => {
    return dataChannelRegistry.subscribe(({ data, peerId }) => {
      const message = parseChannelMessage(data);

      if (message?.type === "file-start") {
        const existing =
          useFileTransferStore.getState().transfers[message.fileId];

        if (!existing) {
          addOrUpdateTransfer({
            createdAt: Date.now(),
            direction: "incoming",
            fileId: message.fileId,
            mime: message.mime,
            name: message.name,
            progress: {
              bytesTransferred: 0,
              fileId: message.fileId,
              percentage: 0,
              totalBytes: message.size
            },
            senderPeerId: peerId,
            size: message.size,
            status: "transferring",
            targetPeerId: localPeerId ?? ""
          });
        }

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
        refreshReceiveTimeout(message.fileId);
        return;
      }

      if (message?.type === "file-chunk-meta") {
        pendingChunkMeta.current.set(peerId, {
          fileId: message.fileId,
          index: message.index,
          totalChunks: message.totalChunks
        });
        refreshReceiveTimeout(message.fileId);
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
        refreshReceiveTimeout(meta.fileId);

        if (
          buffer.chunks.length >= buffer.totalChunks ||
          buffer.receivedBytes >= buffer.size
        ) {
          completeReceivedFile(meta.fileId);
        }
      }
    });
  }, [
    addOrUpdateTransfer,
    completeReceivedFile,
    localPeerId,
    refreshReceiveTimeout,
    updateProgress,
    updateStatus
  ]);

  useEffect(
    () => () => {
      objectUrls.current.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      objectUrls.current.clear();
      receiveTimeouts.current.forEach((timeout) =>
        window.clearTimeout(timeout)
      );
      receiveTimeouts.current.clear();
    },
    []
  );

  useEffect(() => {
    const peerIds = Object.keys(peers);

    if (peerIds.length === 0 || sharedFiles.current.size === 0) {
      return;
    }

    sharedFiles.current.forEach((_sharedFile, sourceFileId) => {
      peerIds.forEach((peerId) => sendSharedFileToPeer(sourceFileId, peerId));
    });
  }, [peers, sendSharedFileToPeer, sharedFileVersion]);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    let cancelled = false;

    void listPersistentSharedFiles(roomId).then((files) => {
      if (cancelled) {
        return;
      }

      let restoredOutgoingCount = 0;

      files.forEach((file) => {
        if (restoredPersistentFileIds.current.has(file.fileId)) {
          return;
        }

        restoredPersistentFileIds.current.add(file.fileId);
        const objectUrl = URL.createObjectURL(file.blob);
        objectUrls.current.add(objectUrl);

        if (file.direction === "outgoing") {
          const restoredFile = new File([file.blob], file.name, {
            lastModified: file.createdAt,
            type: file.mime
          });
          sharedFiles.current.set(file.fileId, {
            file: restoredFile,
            sendingPeerIds: new Set(),
            sentPeerIds: new Set()
          });
          restoredOutgoingCount += 1;
        }

        addOrUpdateTransfer({
          completedAt: file.createdAt,
          createdAt: file.createdAt,
          direction: file.direction,
          fileId: file.fileId,
          mime: file.mime,
          name: file.name,
          objectUrl,
          progress: {
            bytesTransferred: file.size,
            fileId: file.fileId,
            percentage: 100,
            totalBytes: file.size
          },
          senderPeerId:
            file.direction === "outgoing" ? (localPeerId ?? "") : "",
          size: file.size,
          status: "completed",
          targetPeerId: ""
        });
      });

      if (restoredOutgoingCount > 0) {
        setSharedFileVersion((version) => version + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [addOrUpdateTransfer, localPeerId, roomId]);

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

      const sourceFileId = crypto.randomUUID();
      const objectUrl = URL.createObjectURL(file);
      objectUrls.current.add(objectUrl);
      if (roomId) {
        void savePersistentSharedFile(
          roomId,
          sourceFileId,
          file,
          file.name,
          file.type || "application/octet-stream",
          "outgoing"
        );
      }
      sharedFiles.current.set(sourceFileId, {
        file,
        sendingPeerIds: new Set(),
        sentPeerIds: new Set()
      });
      setSharedFileVersion((version) => version + 1);

      addOrUpdateTransfer({
        completedAt: Date.now(),
        createdAt: Date.now(),
        direction: "outgoing",
        fileId: sourceFileId,
        mime: file.type || "application/octet-stream",
        name: file.name,
        objectUrl,
        progress: {
          bytesTransferred: file.size,
          fileId: sourceFileId,
          percentage: 100,
          totalBytes: file.size
        },
        senderPeerId: localPeerId ?? "",
        size: file.size,
        status: "completed",
        targetPeerId: ""
      });

      const peerIds = Object.keys(peers);

      if (peerIds.length === 0) {
        toast.success("File is ready and will be sent to new participants.");
        return;
      }

      peerIds.forEach((peerId) => sendSharedFileToPeer(sourceFileId, peerId));
    },
    [addOrUpdateTransfer, localPeerId, peers, roomId, sendSharedFileToPeer]
  );

  return {
    sendFile,
    transfers
  };
}
