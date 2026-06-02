"use client";

import {
  Camera,
  CameraOff,
  Copy,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
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
  onToggleScreenShare: () => void;
  onToggleVideo: () => void;
  participantsOpen: boolean;
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
  onToggleAudio,
  onToggleChat,
  onToggleParticipants,
  onToggleScreenShare,
  onToggleVideo,
  participantsOpen,
  screenSharing,
  screenShareSupported = true,
  screenShareUnavailableReason = "Screen sharing is not available in this browser.",
  videoEnabled
}: ControlBarProps) {
  const screenShareTitle = screenSharing
    ? "Stop screen sharing"
    : screenShareSupported
      ? "Share screen"
      : screenShareUnavailableReason;

  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-7xl items-center justify-start gap-2 overflow-x-auto border-t border-border bg-surface/95 p-2 shadow-lg backdrop-blur sm:bottom-6 sm:w-fit sm:max-w-full sm:overflow-visible sm:rounded-lg sm:border md:bottom-8">
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
