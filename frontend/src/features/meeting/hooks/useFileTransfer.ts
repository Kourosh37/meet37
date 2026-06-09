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
import {
  assertFilePolicy,
  chunkBlob,
  DEFAULT_FILE_CHUNK_SIZE,
  reassembleChunks
} from "@/lib/utils/fileChunker";
import { isMessageKey } from "@/lib/i18n/messages";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";
import { useLocale } from "@/providers/LocaleProvider";

const OBJECT_URL_TTL_MS = 10 * 60 * 1000;
const RECEIVE_IDLE_TIMEOUT_MS = 30_000;
const RESEND_DELAY_MS = 5_000;

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
  transferIdsByPeerId: Map<string, string>;
}

function totalChunksFor(file: File) {
  return Math.ceil(file.size / DEFAULT_FILE_CHUNK_SIZE);
}

function createSharedFileEntry(file: File): SharedFileEntry {
  return {
    file,
    sendingPeerIds: new Set(),
    sentPeerIds: new Set(),
    transferIdsByPeerId: new Map()
  };
}

function transferIdForPeer(
  sourceFileId: string,
  peerId: string,
  sharedFile: SharedFileEntry
) {
  const existingTransferId = sharedFile.transferIdsByPeerId.get(peerId);

  if (existingTransferId) {
    return existingTransferId;
  }

  const transferId = `${sourceFileId}-${peerId}`;
  sharedFile.transferIdsByPeerId.set(peerId, transferId);
  return transferId;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const batchSize = 0x8000;

  for (let index = 0; index < bytes.length; index += batchSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + batchSize)
    );
  }

  return window.btoa(binary);
}

function base64ToArrayBuffer(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

export function useFileTransfer(roomId: string | null) {
  const { t } = useLocale();
  const getErrorMessage = useCallback(
    (error: unknown, fallbackKey: Parameters<typeof t>[0]) => {
      if (!(error instanceof Error)) {
        return fallbackKey;
      }

      return isMessageKey(error.message) ? error.message : fallbackKey;
    },
    []
  );
  const getToastErrorMessage = useCallback(
    (error: unknown, fallbackKey: Parameters<typeof t>[0]) => {
      const message = getErrorMessage(error, fallbackKey);
      return isMessageKey(message) ? t(message) : message;
    },
    [getErrorMessage, t]
  );
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
    if (!roomId || !localPeerId) {
      return;
    }

    let cancelled = false;

    getRoomFiles(roomId, localPeerId).then((history) => {
      if (!cancelled) {
        loadHistory(history);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadHistory, localPeerId, roomId]);

  const sendFileBytes = useCallback(
    async (fileId: string, peerId: string, file: File) => {
      try {
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

        webSocketManager.send({
          payload: {
            file_id: fileId,
            mime: file.type || "application/octet-stream",
            name: file.name,
            size: file.size,
            total_chunks: totalChunksFor(file)
          },
          to: peerId,
          type: "file-start"
        });

        let bytesTransferred = 0;

        for await (const chunk of chunkBlob(fileId, file)) {
          webSocketManager.send({
            payload: {
              bytes_base64: arrayBufferToBase64(chunk.bytes),
              file_id: fileId,
              index: chunk.index,
              total_chunks: chunk.totalChunks
            },
            to: peerId,
            type: "file-chunk"
          });
          bytesTransferred += chunk.bytes.byteLength;
          updateProgress(fileId, bytesTransferred);
        }

        webSocketManager.send({
          payload: {
            file_id: fileId
          },
          to: peerId,
          type: "file-complete"
        });
        const objectUrl = URL.createObjectURL(file);
        objectUrls.current.add(objectUrl);
        completeTransfer(fileId, objectUrl);
      } catch (error) {
        failTransfer(
          fileId,
          getErrorMessage(error, "error.fileTransferFailed")
        );
        throw error;
      }
    },
    [completeTransfer, failTransfer, getErrorMessage, updateProgress]
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
      const fileId = transferIdForPeer(sourceFileId, peerId, sharedFile);
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
          failTransfer(fileId, "error.fileTransferTimedOut");
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
      }),
      webSocketManager.subscribe("file-start", (message) => {
        const existing =
          useFileTransferStore.getState().transfers[message.payload.file_id];

        if (existing?.status === "completed") {
          return;
        }

        if (!existing) {
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
        }

        receiveBuffers.current.set(message.payload.file_id, {
          chunks: [],
          completed: false,
          mime: message.payload.mime,
          name: message.payload.name,
          receivedBytes: 0,
          size: message.payload.size,
          totalChunks: message.payload.total_chunks
        });
        updateStatus(message.payload.file_id, "transferring");
        refreshReceiveTimeout(message.payload.file_id);
      }),
      webSocketManager.subscribe("file-chunk", (message) => {
        const existing =
          useFileTransferStore.getState().transfers[message.payload.file_id];
        if (existing?.status === "completed") {
          return;
        }

        const buffer = receiveBuffers.current.get(message.payload.file_id);

        if (!buffer) {
          return;
        }

        const bytes = base64ToArrayBuffer(message.payload.bytes_base64);
        buffer.chunks.push({
          bytes,
          fileId: message.payload.file_id,
          index: message.payload.index,
          totalChunks: message.payload.total_chunks
        });
        buffer.receivedBytes += bytes.byteLength;
        updateProgress(message.payload.file_id, buffer.receivedBytes);
        refreshReceiveTimeout(message.payload.file_id);

        if (
          buffer.chunks.length >= buffer.totalChunks ||
          buffer.receivedBytes >= buffer.size
        ) {
          completeReceivedFile(message.payload.file_id);
        }
      }),
      webSocketManager.subscribe("file-complete", (message) => {
        const existing =
          useFileTransferStore.getState().transfers[message.payload.file_id];
        if (existing?.status === "completed") {
          return;
        }

        completeReceivedFile(message.payload.file_id);
      })
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
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
          sharedFiles.current.set(
            file.fileId,
            createSharedFileEntry(restoredFile)
          );
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
        toast.error(getToastErrorMessage(error, "error.fileNotAllowed"));
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
      sharedFiles.current.set(sourceFileId, createSharedFileEntry(file));
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
        toast.success(t("meeting.fileReady"));
        return;
      }

      peerIds.forEach((peerId) => sendSharedFileToPeer(sourceFileId, peerId));
    },
    [
      addOrUpdateTransfer,
      getToastErrorMessage,
      localPeerId,
      peers,
      roomId,
      sendSharedFileToPeer,
      t
    ]
  );

  return {
    sendFile,
    transfers
  };
}
