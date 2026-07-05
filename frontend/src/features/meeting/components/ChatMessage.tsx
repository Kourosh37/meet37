"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { ChatMessageRecord } from "@/features/meeting/stores/chatStore";
import { useLocale } from "@/providers/LocaleProvider";

interface ChatMessageProps {
  message: ChatMessageRecord;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="rounded-md border border-border bg-surface p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-semibold text-foreground">
          {message.displayName}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <time className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat(undefined, {
              hour: "2-digit",
              minute: "2-digit"
            }).format(new Date(message.timestamp))}
          </time>
          <button
            aria-label={t("common.copy")}
            className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={() => void copyMessage()}
            title={t("common.copy")}
            type="button"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
        {message.text}
      </p>
    </article>
  );
}
