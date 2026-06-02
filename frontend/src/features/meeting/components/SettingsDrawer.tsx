"use client";

import { X } from "lucide-react";

interface SettingsDrawerProps {
  audioEnabled: boolean;
  isOpen: boolean;
  onClose: () => void;
  onToggleAudio: () => void;
  onToggleScreenShare: () => void;
  onToggleVideo: () => void;
  screenSharing: boolean;
  screenShareSupported?: boolean;
  screenShareUnavailableReason?: string;
  videoEnabled: boolean;
}

export function SettingsDrawer({
  audioEnabled,
  isOpen,
  onClose,
  onToggleAudio,
  onToggleScreenShare,
  onToggleVideo,
  screenSharing,
  screenShareSupported = true,
  screenShareUnavailableReason = "Screen sharing is not available in this browser.",
  videoEnabled
}: SettingsDrawerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-[min(360px,100vw)] border-l border-border bg-surface p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-surface-foreground">
          Meeting settings
        </h2>
        <button
          aria-label="Close settings"
          className="grid size-9 place-items-center rounded-md border border-border text-foreground transition hover:bg-muted"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-6 grid gap-3">
        <button
          className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground"
          onClick={onToggleAudio}
          type="button"
        >
          Microphone
          <span>{audioEnabled ? "On" : "Off"}</span>
        </button>
        <button
          className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground"
          onClick={onToggleVideo}
          type="button"
        >
          Camera
          <span>{videoEnabled ? "On" : "Off"}</span>
        </button>
        <button
          className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground"
          onClick={onToggleScreenShare}
          title={
            screenSharing || screenShareSupported
              ? undefined
              : screenShareUnavailableReason
          }
          type="button"
        >
          Screen share
          <span>
            {screenSharing
              ? "On"
              : screenShareSupported
                ? "Off"
                : "Unavailable"}
          </span>
        </button>
      </div>
    </aside>
  );
}
