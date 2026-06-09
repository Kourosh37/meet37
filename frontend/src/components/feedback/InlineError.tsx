"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { isMessageKey } from "@/lib/i18n/messages";
import { useLocale } from "@/providers/LocaleProvider";

interface InlineErrorProps {
  className?: string;
  message?: string | null;
}

export function InlineError({ className = "", message }: InlineErrorProps) {
  const { t } = useLocale();
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);
  const rawText = message?.trim();
  const text = rawText && isMessageKey(rawText) ? t(rawText) : rawText;

  useEffect(() => {
    if (rawText && rawText !== dismissedMessage) {
      setDismissedMessage(null);
    }
  }, [dismissedMessage, rawText]);

  if (!rawText || !text || dismissedMessage === rawText) {
    return null;
  }

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger ${className}`}
      role="alert"
    >
      <span className="min-w-0 leading-5">{text}</span>
      <button
        aria-label={t("common.dismissError")}
        className="-me-1 grid size-6 shrink-0 place-items-center rounded-md transition hover:bg-danger/10"
        onClick={() => setDismissedMessage(rawText)}
        type="button"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
