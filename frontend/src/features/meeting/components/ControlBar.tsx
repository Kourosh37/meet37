"use client";

import {
  Camera,
  CameraOff,
  Copy,
  Link2,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Settings,
  SmilePlus
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const REACTION_EMOJIS = [
  "\u{1F44D}",
  "\u{1F44E}",
  "\u{1F44F}",
  "\u{2764}\u{FE0F}",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F389}"
];

interface ControlBarProps {
  audioEnabled: boolean;
  onCopyInvite: () => void;
  onLeave: () => void;
  onOpenSettings: () => void;
  onReaction: (emoji: string) => void;
  onToggleAudio: () => void;
  onToggleChat: () => void;
  onToggleScreenShare: () => void;
  onToggleVideo: () => void;
  screenSharing: boolean;
  screenShareSupported?: boolean;
  screenShareUnavailableReason?: string;
  videoEnabled: boolean;
}

export function ControlBar({
  audioEnabled,
  onCopyInvite,
  onLeave,
  onOpenSettings,
  onReaction,
  onToggleAudio,
  onToggleChat,
  onToggleScreenShare,
  onToggleVideo,
  screenSharing,
  screenShareSupported = true,
  screenShareUnavailableReason = "Screen sharing is not available in this browser.",
  videoEnabled
}: ControlBarProps) {
  const [mounted, setMounted] = useState(false);
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const screenShareTitle = screenSharing
    ? "Stop screen sharing"
    : screenShareSupported
      ? "Share screen"
      : screenShareUnavailableReason;

  useEffect(() => {
    setMounted(true);
  }, []);

  const reactionPicker =
    mounted && reactionMenuOpen
      ? createPortal(
          <div className="fixed bottom-[4.75rem] left-1/2 z-[9999] flex w-[min(24rem,calc(100vw-1rem))] -translate-x-1/2 flex-wrap justify-center gap-1 rounded-lg border border-border bg-surface p-2 shadow-2xl sm:bottom-[5.5rem] sm:w-auto">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                aria-label={`Send ${emoji} reaction`}
                className="grid size-10 place-items-center rounded-md text-2xl transition hover:bg-muted"
                key={emoji}
                onClick={() => {
                  onReaction(emoji);
                  setReactionMenuOpen(false);
                }}
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <footer className="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-7xl items-center justify-center gap-2 overflow-x-auto border-x border-t border-border bg-surface px-3 py-3 shadow-[0_-14px_36px_rgb(15_23_42/0.12)] backdrop-blur sm:px-6 sm:py-4">
        <button
          aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
          className="grid size-11 place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted"
          onClick={onToggleAudio}
          title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
          type="button"
        >
          {audioEnabled ? (
            <Mic className="size-5" />
          ) : (
            <MicOff className="size-5" />
          )}
        </button>
        <button
          aria-label={screenSharing ? "Stop screen sharing" : "Share screen"}
          className={
            screenSharing
              ? "grid size-11 place-items-center rounded-md bg-primary text-primary-foreground transition hover:bg-primary/90"
              : "grid size-11 place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background"
          }
          onClick={onToggleScreenShare}
          title={screenShareTitle}
          type="button"
        >
          <MonitorUp className="size-5" />
        </button>
        <button
          aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
          className="grid size-11 place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted"
          onClick={onToggleVideo}
          title={videoEnabled ? "Turn camera off" : "Turn camera on"}
          type="button"
        >
          {videoEnabled ? (
            <Camera className="size-5" />
          ) : (
            <CameraOff className="size-5" />
          )}
        </button>
        <button
          aria-label="Copy invite link"
          className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-foreground transition hover:bg-muted"
          onClick={onCopyInvite}
          title="Copy invite link"
          type="button"
        >
          <span className="relative grid size-5 place-items-center">
            <Link2 className="size-5" />
            <Copy className="absolute -bottom-1 -right-1 size-3.5 rounded-sm bg-background" />
          </span>
          <span className="hidden whitespace-nowrap text-sm font-semibold sm:inline">
            Copy link
          </span>
        </button>
        <button
          aria-expanded={reactionMenuOpen}
          aria-label="Send reaction"
          className="grid size-11 place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted"
          onClick={() => setReactionMenuOpen((open) => !open)}
          title="Send reaction"
          type="button"
        >
          <SmilePlus className="size-5" />
        </button>
        <button
          aria-label="Open chat"
          className="grid size-11 place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted"
          onClick={onToggleChat}
          title="Open chat"
          type="button"
        >
          <MessageSquare className="size-5" />
        </button>
        <button
          aria-label="Open settings"
          className="grid size-11 place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted"
          onClick={onOpenSettings}
          title="Open settings"
          type="button"
        >
          <Settings className="size-5" />
        </button>
        <button
          aria-label="Leave meeting"
          className="grid size-11 place-items-center rounded-md bg-danger text-danger-foreground transition hover:bg-danger/90"
          onClick={onLeave}
          title="Leave meeting"
          type="button"
        >
          <LogOut className="size-5" />
        </button>
      </footer>
      {reactionPicker}
    </>
  );
}
