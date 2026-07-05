export type FileTransferDirection = "incoming" | "outgoing";
export type FileTransferRuntimeStatus =
  | "offered"
  | "accepted"
  | "rejected"
  | "transferring"
  | "completed"
  | "failed"
  | "cancelled";

export interface FileOffer {
  fileId: string;
  groupId?: string;
  senderPeerId: string;
  targetPeerId: string;
  name: string;
  size: number;
  mime: string;
}

export interface FileChunk {
  fileId: string;
  index: number;
  totalChunks: number;
  bytes: ArrayBuffer;
}

export interface FileTransferProgress {
  fileId: string;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export interface FileTransferRecord extends FileOffer {
  direction: FileTransferDirection;
  status: FileTransferRuntimeStatus;
  progress: FileTransferProgress;
  reason?: string;
  objectUrl?: string;
  createdAt: number;
  completedAt?: number;
}
