"use client";

import { Download, FileText } from "lucide-react";
import { InlineError } from "@/components/feedback/InlineError";
import type {
  FileTransferRecord,
  FileTransferRuntimeStatus
} from "@/features/meeting/types/file";
import { formatBytes } from "@/lib/utils/formatters";
import { useLocale } from "@/providers/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";

interface FileTransferItemProps {
  embedded?: boolean;
  showSender?: boolean;
  transfer: FileTransferRecord;
}

export function FileTransferItem({
  embedded = false,
  showSender = true,
  transfer
}: FileTransferItemProps) {
  const { t } = useLocale();
  const localPeerId = useMeetingStore((state) => state.localPeerId);
  const senderName = useMeetingStore((state) =>
    transfer.senderPeerId === state.localPeerId
      ? "You"
      : (state.peers[transfer.senderPeerId]?.displayName ?? "Participant")
  );
  const statusLabels: Record<FileTransferRuntimeStatus, MessageKey> = {
    accepted: "file.statusAccepted",
    cancelled: "file.statusCancelled",
    completed: "file.statusCompleted",
    failed: "file.statusFailed",
    offered: "file.statusOffered",
    rejected: "file.statusRejected",
    transferring: "file.statusTransferring"
  };
  const Wrapper = embedded ? "div" : "article";

  return (
    <Wrapper
      className={
        embedded
          ? "rounded-md border border-border bg-background p-3"
          : "rounded-md border border-border bg-surface p-3 shadow-sm"
      }
    >
      <div className="flex gap-3">
        <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {transfer.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {showSender ? (
              <>
                {transfer.senderPeerId === localPeerId ? "You" : senderName} -{" "}
              </>
            ) : null}
            {formatBytes(transfer.size)} -{" "}
            {transfer.mime || t("common.unknown")} -{" "}
            {t(statusLabels[transfer.status])}
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
          <InlineError className="mt-2 text-xs" message={transfer.reason} />
        </div>
      </div>

      {transfer.objectUrl ? (
        <a
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          download={transfer.name}
          href={transfer.objectUrl}
        >
          <Download className="size-3.5" />
          {t("file.download")}
        </a>
      ) : null}
    </Wrapper>
  );
}
