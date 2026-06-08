"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { ChatMessage } from "@/features/meeting/components/ChatMessage";
import { FileTransferItem } from "@/features/meeting/components/FileTransferItem";
import { FileTransferPanel } from "@/features/meeting/components/FileTransferPanel";
import { useChat } from "@/features/meeting/hooks/useChat";
import { useFileTransfer } from "@/features/meeting/hooks/useFileTransfer";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string | null;
}

export function ChatPanel({ isOpen, onClose, roomId }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [shouldRender, setShouldRender] = useState(isOpen);
  const chat = useChat(roomId, isOpen);
  const files = useFileTransfer(roomId);
  const timeline = [
    ...chat.messages.map((message) => ({
      id: message.id,
      timestamp: message.timestamp,
      type: "message" as const,
      value: message
    })),
    ...files.transfers
      .filter(
        (transfer) =>
          !(transfer.direction === "outgoing" && transfer.targetPeerId)
      )
      .map((transfer) => ({
        id: transfer.fileId,
        timestamp: transfer.createdAt,
        type: "file" as const,
        value: transfer
      }))
  ].sort((left, right) => left.timestamp - right.timestamp);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      return;
    }

    const timeout = window.setTimeout(() => setShouldRender(false), 260);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  if (!shouldRender) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    chat.sendMessage(draft);
    setDraft("");
  }

  return (
    <aside
      className={
        isOpen
          ? "meet-chat-panel-open fixed bottom-[4.25rem] right-0 top-0 z-40 flex w-[min(420px,100vw)] flex-col border-l border-border bg-surface shadow-xl sm:bottom-[4.75rem] lg:inset-y-0"
          : "meet-chat-panel-close fixed bottom-[4.25rem] right-0 top-0 z-40 flex w-[min(420px,100vw)] flex-col border-l border-border bg-surface shadow-xl sm:bottom-[4.75rem] lg:inset-y-0"
      }
    >
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-sm font-semibold text-surface-foreground">
            Chat
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {chat.isLoadingHistory ? (
              <span className="inline-flex items-center gap-1.5">
                <LoadingSpinner label="Loading chat history" size="sm" />
                Loading history
              </span>
            ) : (
              `${chat.messages.length} messages`
            )}
          </p>
        </div>
        <button
          aria-label="Close chat"
          className="grid size-9 place-items-center rounded-md border border-border text-foreground transition hover:bg-muted"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {timeline.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No messages yet.
          </p>
        ) : (
          timeline.map((entry) =>
            entry.type === "message" ? (
              <ChatMessage key={entry.id} message={entry.value} />
            ) : (
              <FileTransferItem key={entry.id} transfer={entry.value} />
            )
          )
        )}
      </div>

      <FileTransferPanel onSendFile={files.sendFile} />

      <form className="border-t border-border p-4" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="meeting-chat-message">
          Message
        </label>
        <div className="flex gap-2">
          <input
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            id="meeting-chat-message"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message"
            value={draft}
          />
          <button
            className="rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            type="submit"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
}
