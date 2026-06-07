"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface InlineErrorProps {
  className?: string;
  message?: string | null;
}

export function InlineError({ className = "", message }: InlineErrorProps) {
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);
  const text = message?.trim();

  useEffect(() => {
    if (text && text !== dismissedMessage) {
      setDismissedMessage(null);
    }
  }, [dismissedMessage, text]);

  if (!text || dismissedMessage === text) {
    return null;
  }

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger ${className}`}
      role="alert"
    >
      <span className="min-w-0 leading-5">{text}</span>
      <button
        aria-label="Dismiss error"
        className="-mr-1 grid size-6 shrink-0 place-items-center rounded-md transition hover:bg-danger/10"
        onClick={() => setDismissedMessage(text)}
        type="button"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
