"use client";

import { FileText } from "lucide-react";
import type { FileTransferRecord } from "@/features/meeting/types/file";
import { formatBytes } from "@/lib/utils/formatters";

interface FileTransferItemProps {
  onAccept: (fileId: string) => void;
  onReject: (fileId: string) => void;
  transfer: FileTransferRecord;
}

export function FileTransferItem({
  onAccept,
  onReject,
  transfer
}: FileTransferItemProps) {
  return (
    <article className="rounded-md border border-border bg-background p-3">
      <div className="flex gap-3">
        <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {transfer.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatBytes(transfer.size)} · {transfer.status}
          </p>
          {transfer.reason ? (
            <p className="mt-1 text-xs text-danger">{transfer.reason}</p>
          ) : null}
        </div>
      </div>

      {transfer.direction === "incoming" && transfer.status === "offered" ? (
        <div className="mt-3 flex gap-2">
          <button
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            onClick={() => onAccept(transfer.fileId)}
            type="button"
          >
            Accept
          </button>
          <button
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
            onClick={() => onReject(transfer.fileId)}
            type="button"
          >
            Reject
          </button>
        </div>
      ) : null}
    </article>
  );
}
