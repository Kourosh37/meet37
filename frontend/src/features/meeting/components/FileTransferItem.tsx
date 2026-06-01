"use client";

import { Download, FileText } from "lucide-react";
import type { FileTransferRecord } from "@/features/meeting/types/file";
import { formatBytes } from "@/lib/utils/formatters";

interface FileTransferItemProps {
  transfer: FileTransferRecord;
}

export function FileTransferItem({ transfer }: FileTransferItemProps) {
  return (
    <article className="rounded-md border border-border bg-background p-3">
      <div className="flex gap-3">
        <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {transfer.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatBytes(transfer.size)} - {transfer.mime || "unknown"} -{" "}
            {transfer.status}
          </p>
          {["offered", "accepted", "transferring"].includes(transfer.status) ? (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${transfer.progress.percentage}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {Math.round(transfer.progress.percentage)}%
              </p>
            </div>
          ) : null}
          {transfer.reason ? (
            <p className="mt-1 text-xs text-danger">{transfer.reason}</p>
          ) : null}
        </div>
      </div>

      {transfer.objectUrl ? (
        <a
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          download={transfer.name}
          href={transfer.objectUrl}
        >
          <Download className="size-3.5" />
          Download
        </a>
      ) : null}
    </article>
  );
}
