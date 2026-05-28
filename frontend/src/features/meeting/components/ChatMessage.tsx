"use client";

import type { ChatMessageRecord } from "@/features/meeting/stores/chatStore";

interface ChatMessageProps {
  message: ChatMessageRecord;
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <article className="rounded-md bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-semibold text-foreground">
          {message.displayName}
        </p>
        <time className="shrink-0 text-xs text-muted-foreground">
          {new Intl.DateTimeFormat(undefined, {
            hour: "2-digit",
            minute: "2-digit"
          }).format(new Date(message.timestamp))}
        </time>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
        {message.text}
      </p>
    </article>
  );
}
