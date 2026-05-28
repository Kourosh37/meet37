import type { FileTransferRecord } from "@/features/meeting/types/file";
import type { FileHistoryItem } from "@/types/api";
import { create } from "zustand";

interface FileTransferState {
  transfers: Record<string, FileTransferRecord>;
  addOrUpdateTransfer: (transfer: FileTransferRecord) => void;
  completeTransfer: (fileId: string, objectUrl?: string) => void;
  failTransfer: (fileId: string, reason: string) => void;
  loadHistory: (items: FileHistoryItem[]) => void;
  updateProgress: (fileId: string, bytesTransferred: number) => void;
  updateStatus: (
    fileId: string,
    status: FileTransferRecord["status"],
    reason?: string
  ) => void;
  reset: () => void;
}

function fromHistory(item: FileHistoryItem): FileTransferRecord {
  return {
    createdAt: item.ts * 1000,
    direction: "incoming",
    fileId: item.file_id,
    mime: item.mime,
    name: item.name,
    progress: {
      bytesTransferred: 0,
      fileId: item.file_id,
      percentage: 0,
      totalBytes: item.size
    },
    reason: item.reason,
    senderPeerId: item.sender_peer_id,
    size: item.size,
    status: item.status === "answered" ? "accepted" : item.status,
    targetPeerId: item.target_peer_id
  };
}

export const useFileTransferStore = create<FileTransferState>((set) => ({
  transfers: {},

  addOrUpdateTransfer: (transfer) =>
    set((state) => ({
      transfers: {
        ...state.transfers,
        [transfer.fileId]: transfer
      }
    })),

  completeTransfer: (fileId, objectUrl) =>
    set((state) => {
      const transfer = state.transfers[fileId];

      if (!transfer) {
        return state;
      }

      return {
        transfers: {
          ...state.transfers,
          [fileId]: {
            ...transfer,
            completedAt: Date.now(),
            objectUrl,
            progress: {
              ...transfer.progress,
              bytesTransferred: transfer.size,
              percentage: 100
            },
            status: "completed"
          }
        }
      };
    }),

  failTransfer: (fileId, reason) =>
    set((state) => {
      const transfer = state.transfers[fileId];

      if (!transfer) {
        return state;
      }

      return {
        transfers: {
          ...state.transfers,
          [fileId]: {
            ...transfer,
            reason,
            status: "failed"
          }
        }
      };
    }),

  loadHistory: (items) =>
    set({
      transfers: Object.fromEntries(
        items.map((item) => [item.file_id, fromHistory(item)])
      )
    }),

  reset: () => set({ transfers: {} }),

  updateProgress: (fileId, bytesTransferred) =>
    set((state) => {
      const transfer = state.transfers[fileId];

      if (!transfer) {
        return state;
      }

      return {
        transfers: {
          ...state.transfers,
          [fileId]: {
            ...transfer,
            progress: {
              ...transfer.progress,
              bytesTransferred,
              percentage:
                transfer.size > 0
                  ? Math.min(100, (bytesTransferred / transfer.size) * 100)
                  : 0
            },
            status: "transferring"
          }
        }
      };
    }),

  updateStatus: (fileId, status, reason) =>
    set((state) => {
      const transfer = state.transfers[fileId];

      if (!transfer) {
        return state;
      }

      return {
        transfers: {
          ...state.transfers,
          [fileId]: {
            ...transfer,
            completedAt:
              status === "accepted" || status === "rejected"
                ? Date.now()
                : undefined,
            reason,
            status
          }
        }
      };
    })
}));
