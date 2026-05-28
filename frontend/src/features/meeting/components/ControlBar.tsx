"use client";

import {
  Camera,
  CameraOff,
  Copy,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  Settings,
  Users
} from "lucide-react";

interface ControlBarProps {
  audioEnabled: boolean;
  onCopyInvite: () => void;
  onLeave: () => void;
  onOpenSettings: () => void;
  onToggleAudio: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleVideo: () => void;
  participantsOpen: boolean;
  videoEnabled: boolean;
}

export function ControlBar({
  audioEnabled,
  onCopyInvite,
  onLeave,
  onOpenSettings,
  onToggleAudio,
  onToggleChat,
  onToggleParticipants,
  onToggleVideo,
  participantsOpen,
  videoEnabled
}: ControlBarProps) {
  return (
    <footer className="sticky bottom-4 z-10 mx-auto flex w-fit max-w-full items-center gap-2 rounded-lg border border-border bg-surface/95 p-2 shadow-lg backdrop-blur">
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
        className="grid size-11 place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted"
        onClick={onCopyInvite}
        title="Copy invite link"
        type="button"
      >
        <Copy className="size-5" />
      </button>
      <button
        aria-label={
          participantsOpen ? "Hide participants" : "Show participants"
        }
        className="grid size-11 place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted"
        onClick={onToggleParticipants}
        title={participantsOpen ? "Hide participants" : "Show participants"}
        type="button"
      >
        <Users className="size-5" />
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
  );
}
