"use client";

import { ChangeEvent } from "react";
import { Paperclip } from "lucide-react";
import { FileTransferItem } from "@/features/meeting/components/FileTransferItem";
import type { FileTransferRecord } from "@/features/meeting/types/file";

interface FileTransferPanelProps {
  onAccept: (fileId: string) => void;
  onReject: (fileId: string) => void;
  onSendOffer: (file: File) => void;
  transfers: FileTransferRecord[];
}

export function FileTransferPanel({
  onAccept,
  onReject,
  onSendOffer,
  transfers
}: FileTransferPanelProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      onSendOffer(file);
      event.target.value = "";
    }
  }

  return (
    <section className="border-t border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-surface-foreground">Files</h3>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted">
          <Paperclip className="size-3.5" />
          Offer file
          <input className="sr-only" onChange={handleFileChange} type="file" />
        </label>
      </div>

      <div className="mt-3 grid max-h-44 gap-2 overflow-y-auto">
        {transfers.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            No file offers yet.
          </p>
        ) : (
          transfers.map((transfer) => (
            <FileTransferItem
              key={transfer.fileId}
              onAccept={onAccept}
              onReject={onReject}
              transfer={transfer}
            />
          ))
        )}
      </div>
    </section>
  );
}
