"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Files, MessageSquare, Paperclip, Send, X } from "lucide-react";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { ChatMessage } from "@/features/meeting/components/ChatMessage";
import { FileTransferItem } from "@/features/meeting/components/FileTransferItem";
import { useChat } from "@/features/meeting/hooks/useChat";
import { useFileTransfer } from "@/features/meeting/hooks/useFileTransfer";
import type { ChatMessageRecord } from "@/features/meeting/stores/chatStore";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import type { FileTransferRecord } from "@/features/meeting/types/file";
import { useLocale } from "@/providers/LocaleProvider";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string | null;
}

export function ChatPanel({ isOpen, onClose, roomId }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [viewMode, setViewMode] = useState<"all" | "files">("all");
  const panelRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chat = useChat(roomId, isOpen);
  const files = useFileTransfer(roomId);
  const localPeerId = useMeetingStore((state) => state.localPeerId);
  const peers = useMeetingStore((state) => state.peers);
  const { t } = useLocale();
  const timeline = useMemo(() => {
    type TimelineGroup = {
      displayName: string;
      files: FileTransferRecord[];
      id: string;
      message?: ChatMessageRecord;
      peerId?: string;
      timestamp: number;
    };
    const groups = new Map<string, TimelineGroup>();
    const visibleTransfers = files.transfers.filter(
      (transfer) =>
        !(transfer.direction === "outgoing" && transfer.targetPeerId)
    );

    function displayNameForFile(transfer: FileTransferRecord) {
      if (transfer.senderPeerId === localPeerId) {
        return "You";
      }

      return peers[transfer.senderPeerId]?.displayName ?? "Participant";
    }

    chat.messages.forEach((message) => {
      const id = message.groupId ?? `message:${message.id}`;
      const existing = groups.get(id);

      groups.set(id, {
        displayName: message.displayName,
        files: existing?.files ?? [],
        id,
        message,
        peerId: message.peerId,
        timestamp: Math.min(
          existing?.timestamp ?? message.timestamp,
          message.timestamp
        )
      });
    });

    visibleTransfers.forEach((transfer) => {
      const id = transfer.groupId ?? `file:${transfer.fileId}`;
      const existing = groups.get(id);

      groups.set(id, {
        displayName: existing?.displayName ?? displayNameForFile(transfer),
        files: [...(existing?.files ?? []), transfer],
        id,
        message: existing?.message,
        peerId: existing?.peerId ?? transfer.senderPeerId,
        timestamp: Math.min(
          existing?.timestamp ?? transfer.createdAt,
          transfer.createdAt
        )
      });
    });

    return [...groups.values()].sort(
      (left, right) => left.timestamp - right.timestamp
    );
  }, [chat.messages, files.transfers, localPeerId, peers]);
  const displayedTimeline = useMemo(
    () =>
      viewMode === "files"
        ? timeline.filter((entry) => entry.files.length > 0)
        : timeline,
    [timeline, viewMode]
  );
  const lastDisplayedTimelineId = displayedTimeline.at(-1)?.id ?? "";

  const scrollToLatestMessage = useCallback(() => {
    timelineRef.current?.scrollTo({
      behavior: "auto",
      top: timelineRef.current.scrollHeight
    });
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      return;
    }

    const timeout = window.setTimeout(() => setShouldRender(false), 260);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !shouldRender) {
      return;
    }

    scrollToLatestMessage();
    const animationFrame = window.requestAnimationFrame(scrollToLatestMessage);
    const timeouts = [50, 150, 320].map((delay) =>
      window.setTimeout(scrollToLatestMessage, delay)
    );

    return () => {
      window.cancelAnimationFrame(animationFrame);
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [
    chat.isLoadingHistory,
    displayedTimeline.length,
    isOpen,
    lastDisplayedTimelineId,
    scrollToLatestMessage,
    shouldRender
  ]);

  useEffect(() => {
    if (!isOpen || !shouldRender) {
      return;
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;

      if (target instanceof Node && !panelRef.current?.contains(target)) {
        onClose();
      }
    }

    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [isOpen, onClose, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();

    if (!trimmed && attachedFiles.length === 0) {
      return;
    }

    const groupId =
      attachedFiles.length > 0 ? `chat-file-${crypto.randomUUID()}` : undefined;
    const createdAt = Date.now();

    if (trimmed) {
      chat.sendMessage(trimmed, groupId);
    }

    if (attachedFiles.length > 0) {
      attachedFiles.forEach((file) => {
        files.sendFile(file, { createdAt, groupId });
      });
      setAttachedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }

    setDraft("");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length > 0) {
      setAttachedFiles((current) => [...current, ...selectedFiles]);
    }

    event.target.value = "";
  }

  return (
    <aside
      ref={panelRef}
      className={
        isOpen
          ? "meet-chat-panel-open fixed bottom-[8rem] end-0 top-0 z-40 flex w-[min(420px,100vw)] flex-col border-s border-border bg-surface shadow-xl sm:bottom-[4.75rem] lg:inset-y-0"
          : "meet-chat-panel-close fixed bottom-[8rem] end-0 top-0 z-40 flex w-[min(420px,100vw)] flex-col border-s border-border bg-surface shadow-xl sm:bottom-[4.75rem] lg:inset-y-0"
      }
    >
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-surface-foreground">
              {t("meeting.chat")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {chat.isLoadingHistory ? (
                <span className="inline-flex items-center gap-1.5">
                  <LoadingSpinner
                    label={t("meeting.loadingChatHistory")}
                    size="sm"
                  />
                  {t("meeting.loadingChatHistory")}
                </span>
              ) : (
                t("meeting.messages", { count: chat.messages.length })
              )}
            </p>
          </div>
          <button
            aria-label={t("meeting.closeChat")}
            className="grid size-9 place-items-center rounded-md border border-border text-foreground transition hover:bg-muted"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          aria-label={t("meeting.chat")}
          className="mt-3 grid grid-cols-2 gap-1 rounded-md border border-border bg-background p-1"
          role="tablist"
        >
          <button
            aria-selected={viewMode === "all"}
            className={
              viewMode === "all"
                ? "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm"
                : "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            }
            onClick={() => setViewMode("all")}
            role="tab"
            type="button"
          >
            <MessageSquare className="size-4" />
            {t("meeting.chat")}
          </button>
          <button
            aria-selected={viewMode === "files"}
            className={
              viewMode === "files"
                ? "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm"
                : "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            }
            onClick={() => setViewMode("files")}
            role="tab"
            type="button"
          >
            <Files className="size-4" />
            {t("common.files")}
          </button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/45 p-4"
        ref={timelineRef}
      >
        {displayedTimeline.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            {viewMode === "files"
              ? t("meeting.emptyFiles")
              : t("meeting.emptyChat")}
          </p>
        ) : (
          displayedTimeline.map((entry) =>
            entry.files.length === 0 && entry.message ? (
              <ChatMessage key={entry.id} message={entry.message} />
            ) : (
              <article
                className="rounded-md border border-border bg-surface p-3 shadow-sm"
                key={entry.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {entry.displayName}
                  </p>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(undefined, {
                      hour: "2-digit",
                      minute: "2-digit"
                    }).format(new Date(entry.timestamp))}
                  </time>
                </div>
                <div className="mt-3 space-y-2">
                  {entry.files.map((transfer) => (
                    <FileTransferItem
                      embedded
                      key={transfer.fileId}
                      showSender={false}
                      transfer={transfer}
                    />
                  ))}
                </div>
                {entry.message ? (
                  <p className="mt-3 whitespace-pre-wrap break-words rounded-md bg-background px-3 py-2 text-sm leading-6 text-foreground">
                    {entry.message.text}
                  </p>
                ) : null}
              </article>
            )
          )
        )}
        <div aria-hidden="true" ref={bottomRef} />
      </div>
      <form className="border-t border-border p-4" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="meeting-chat-message">
          {t("meeting.chat")}
        </label>
        {attachedFiles.length > 0 ? (
          <div className="mb-3 space-y-2">
            {attachedFiles.map((file, index) => (
              <div
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
                key={`${file.name}-${file.size}-${index}`}
              >
                <p className="min-w-0 truncate text-xs font-medium text-foreground">
                  {file.name}
                </p>
                <button
                  aria-label={t("common.remove")}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  onClick={() =>
                    setAttachedFiles((current) =>
                      current.filter((_, fileIndex) => fileIndex !== index)
                    )
                  }
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            id="meeting-chat-message"
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("meeting.typeMessage")}
            value={draft}
          />
          <button
            aria-label={t("file.sendFile")}
            className="grid size-10 shrink-0 place-items-center rounded-md border border-border text-foreground transition hover:bg-muted"
            onClick={() => fileInputRef.current?.click()}
            title={t("file.sendFile")}
            type="button"
          >
            <Paperclip className="size-4" />
          </button>
          <input
            className="sr-only"
            multiple
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
          <button
            aria-label={t("common.send")}
            className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            type="submit"
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </aside>
  );
}
