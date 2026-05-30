"use client";

import { ChangeEvent } from "react";
import { Paperclip } from "lucide-react";

interface FileTransferPanelProps {
  onSendFile: (file: File) => void;
}

export function FileTransferPanel({
  onSendFile
}: FileTransferPanelProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      onSendFile(file);
      event.target.value = "";
    }
  }

  return (
    <section className="border-t border-border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-surface-foreground">Files</h3>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted">
          <Paperclip className="size-3.5" />
          Send file
          <input className="sr-only" onChange={handleFileChange} type="file" />
        </label>
      </div>
    </section>
  );
}
