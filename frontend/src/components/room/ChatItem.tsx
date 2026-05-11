import { memo, useMemo } from 'react';

import { DownloadIcon } from '../icons';

export type ChatItemMessage = {
  id: string;
  from: string;
  createdAt: string;
} & (
  | { kind: 'text'; text: string }
  | { kind: 'file'; filename: string; size: number; downloadUrl: string; mimeType: string }
);

function isImageFile(mimeType: string, filename: string) {
  return mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename);
}

function ChatItemBase({ message, isSelf }: { message: ChatItemMessage; isSelf: boolean }) {
  const timeLabel = useMemo(
    () => new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [message.createdAt],
  );

  if (message.kind === 'text') {
    return (
      <article
        className={`rounded-2xl border border-[color:var(--border)] p-4 text-sm ${
          isSelf ? 'bg-emerald-400/10 text-main' : 'bg-surface-2 text-main'
        }`}
      >
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted">
          <span>{message.from}</span>
          <span>{timeLabel}</span>
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-[color:var(--border)] bg-surface-2 p-4 text-sm text-main">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted">
        <span>{message.from}</span>
        <span>{timeLabel}</span>
      </div>
      <div className="mt-4 grid gap-3">
        {isImageFile(message.mimeType, message.filename) ? (
          <img
            src={message.downloadUrl}
            alt={message.filename}
            className="max-h-40 w-full rounded-xl border border-[color:var(--border)] object-cover"
            loading="lazy"
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-main">{message.filename}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              {Math.max(1, Math.ceil(message.size / 1024))} KB
            </p>
          </div>
          <a className="btn btn-ghost" href={message.downloadUrl} target="_blank" rel="noreferrer">
            <DownloadIcon className="h-4 w-4" />
            Download
          </a>
        </div>
      </div>
    </article>
  );
}

export const ChatItem = memo(ChatItemBase);
