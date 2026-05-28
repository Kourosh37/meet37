"use client";

import { useCallback, useEffect, useMemo } from "react";
import { getRoomFiles } from "@/features/rooms/api/roomsApi";
import { useFileTransferStore } from "@/features/meeting/stores/fileTransferStore";
import type { FileTransferRecord } from "@/features/meeting/types/file";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

export function useFileTransfer(roomId: string | null) {
  const transfersById = useFileTransferStore((state) => state.transfers);
  const addOrUpdateTransfer = useFileTransferStore(
    (state) => state.addOrUpdateTransfer
  );
  const loadHistory = useFileTransferStore((state) => state.loadHistory);
  const updateStatus = useFileTransferStore((state) => state.updateStatus);
  const localPeerId = useMeetingStore((state) => state.localPeerId);
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
          status: "offered",
          targetPeerId: localPeerId ?? ""
        });
      }),
      webSocketManager.subscribe("file-answer", (message) => {
        updateStatus(
          message.payload.file_id,
          message.payload.accepted ? "accepted" : "rejected",
          message.payload.reason
        );
      })
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [addOrUpdateTransfer, localPeerId, updateStatus]);

  const sendOffer = useCallback(
    (file: File) => {
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
        status: "offered",
        targetPeerId: ""
      };

      addOrUpdateTransfer(transfer);
      webSocketManager.send({
        payload: {
          file_id: fileId,
          mime: transfer.mime,
          name: file.name,
          size: file.size
        },
        type: "file-offer"
      });
    },
    [addOrUpdateTransfer, localPeerId]
  );

  const acceptOffer = useCallback(
    (fileId: string) => {
      updateStatus(fileId, "accepted");
      webSocketManager.send({
        payload: { accepted: true, file_id: fileId },
        type: "file-answer"
      });
    },
    [updateStatus]
  );

  const rejectOffer = useCallback(
    (fileId: string, reason = "Declined") => {
      updateStatus(fileId, "rejected", reason);
      webSocketManager.send({
        payload: { accepted: false, file_id: fileId, reason },
        type: "file-answer"
      });
    },
    [updateStatus]
  );

  return {
    acceptOffer,
    rejectOffer,
    sendOffer,
    transfers
  };
}
