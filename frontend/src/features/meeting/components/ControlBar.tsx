"use client";

import {
  Camera,
  CameraOff,
  Copy,
  Link2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  Settings,
  SmilePlus
} from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { DeviceSplitControl } from "@/features/meeting/components/DeviceSplitControl";
import { useLocale } from "@/providers/LocaleProvider";

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
  audioInputs?: MediaDeviceInfo[];
  canChat?: boolean;
  canReact?: boolean;
  canShareScreen?: boolean;
  canUseCamera?: boolean;
  canUseMic?: boolean;
  chatUnreadCount?: number;
  onCopyInvite: () => void;
  onLeave: () => void;
  onOpenSettings: () => void;
  onReaction: (emoji: string) => void;
  onSelectAudioDevice?: (deviceId: string) => void;
  onSelectVideoDevice?: (deviceId: string) => void;
  onToggleAudio: () => void;
  onToggleChat: () => void;
  onToggleScreenShare: () => void;
  onToggleVideo: () => void;
  screenSharing: boolean;
  screenShareSupported?: boolean;
  screenShareUnavailableReason?: string;
  selectedAudioDeviceId?: string;
  selectedVideoDeviceId?: string;
  videoEnabled: boolean;
  videoInputs?: MediaDeviceInfo[];
}

export function ControlBar({
  audioEnabled,
  audioInputs = [],
  canChat = true,
  canReact = true,
  canShareScreen = true,
  canUseCamera = true,
  canUseMic = true,
  chatUnreadCount = 0,
  onCopyInvite,
  onLeave,
  onOpenSettings,
  onReaction,
  onSelectAudioDevice,
  onSelectVideoDevice,
  onToggleAudio,
  onToggleChat,
  onToggleScreenShare,
  onToggleVideo,
  screenSharing,
  screenShareSupported = true,
  screenShareUnavailableReason = "Screen sharing is not available in this browser.",
  selectedAudioDeviceId = "",
  selectedVideoDeviceId = "",
  videoEnabled,
  videoInputs = []
}: ControlBarProps) {
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const screenShareTitle = screenSharing
    ? t("meeting.stopScreenSharing")
    : !canShareScreen
      ? t("meeting.screenSharePermissionDisabled")
      : screenShareSupported
        ? t("meeting.shareScreen")
        : screenShareUnavailableReason;
  const chatUnreadLabel =
    chatUnreadCount > 99 ? "+99" : chatUnreadCount.toString();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!canReact) {
      setReactionMenuOpen(false);
    }
  }, [canReact]);

  const reactionPicker =
    mounted && reactionMenuOpen
      ? createPortal(
          <div className="meet-emoji-picker fixed bottom-[8.5rem] left-1/2 z-[9999] flex w-[min(24rem,calc(100vw-1rem))] -translate-x-1/2 flex-wrap justify-center gap-1 rounded-lg border border-border bg-surface p-2 shadow-2xl sm:bottom-[5.5rem] sm:w-auto">
            {REACTION_EMOJIS.map((emoji, index) => (
              <button
                aria-label={t("meeting.sendEmojiReaction", { emoji })}
                className="meet-emoji-button grid size-10 place-items-center rounded-md text-2xl transition hover:bg-muted"
                key={emoji}
                onClick={() => {
                  onReaction(emoji);
                  setReactionMenuOpen(false);
                }}
                style={{ "--meet-emoji-index": index } as CSSProperties}
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
      <footer className="fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full max-w-7xl grid-cols-4 justify-items-stretch gap-2 border-x border-t border-border bg-surface px-2 py-3 shadow-[0_-14px_36px_rgb(15_23_42/0.12)] backdrop-blur sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-4">
        <DeviceSplitControl
          activeIcon={<Mic className="size-5" />}
          className="w-full sm:w-auto"
          defaultDeviceLabel={t("meeting.defaultMicrophone")}
          devices={audioInputs}
          disabled={!audioEnabled && !canUseMic}
          inactiveIcon={<MicOff className="size-5" />}
          isEnabled={audioEnabled}
          label={t("meeting.microphone")}
          onSelectDevice={onSelectAudioDevice ?? (() => undefined)}
          onToggle={onToggleAudio}
          selectLabel={t("meeting.selectMicrophone")}
          selectedDeviceId={selectedAudioDeviceId}
          title={
            audioEnabled
              ? t("meeting.muteMicrophone")
              : canUseMic
                ? t("meeting.unmuteMicrophone")
                : t("meeting.microphonePermissionTitle")
          }
          toggleLabel={
            audioEnabled
              ? t("meeting.muteMicrophone")
              : t("meeting.unmuteMicrophone")
          }
        />
        <DeviceSplitControl
          activeIcon={<Camera className="size-5" />}
          className="w-full sm:w-auto"
          defaultDeviceLabel={t("meeting.defaultCamera")}
          devices={videoInputs}
          disabled={!videoEnabled && !canUseCamera}
          inactiveIcon={<CameraOff className="size-5" />}
          isEnabled={videoEnabled}
          label={t("meeting.camera")}
          onSelectDevice={onSelectVideoDevice ?? (() => undefined)}
          onToggle={onToggleVideo}
          selectLabel={t("meeting.selectCamera")}
          selectedDeviceId={selectedVideoDeviceId}
          title={
            videoEnabled
              ? t("meeting.turnCameraOff")
              : canUseCamera
                ? t("meeting.turnCameraOn")
                : t("meeting.cameraPermissionTitle")
          }
          toggleLabel={
            videoEnabled
              ? t("meeting.turnCameraOff")
              : t("meeting.turnCameraOn")
          }
        />
        <button
          aria-label={
            screenSharing
              ? t("meeting.stopScreenSharing")
              : t("meeting.shareScreen")
          }
          className={
            screenSharing
              ? "grid h-12 w-full place-items-center rounded-md bg-primary text-primary-foreground transition hover:bg-primary/90 sm:size-12"
              : "grid h-12 w-full place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background sm:size-12"
          }
          onClick={onToggleScreenShare}
          disabled={!screenSharing && !canShareScreen}
          title={screenShareTitle}
          type="button"
        >
          <MonitorUp className="size-5" />
        </button>

        <button
          aria-label={t("meeting.copyInvite")}
          className="inline-flex h-12 w-full min-w-12 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-foreground transition hover:bg-muted sm:w-auto"
          onClick={onCopyInvite}
          title={t("meeting.copyInvite")}
          type="button"
        >
          <span className="relative grid size-5 place-items-center">
            <Link2 className="size-5" />
            <Copy className="absolute -bottom-1 -end-1 size-3.5 rounded-sm bg-background" />
          </span>
          <span className="hidden whitespace-nowrap text-sm font-semibold sm:inline">
            {t("meeting.copyInvite")}
          </span>
        </button>
        <button
          aria-expanded={reactionMenuOpen}
          aria-label={t("meeting.sendReaction")}
          className="grid h-12 w-full place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background sm:size-12"
          disabled={!canReact}
          onClick={() => setReactionMenuOpen((open) => !open)}
          title={
            canReact
              ? t("meeting.sendReaction")
              : t("meeting.reactionsPermissionTitle")
          }
          type="button"
        >
          <SmilePlus className="size-5" />
        </button>
        <button
          aria-label={
            chatUnreadCount > 0
              ? `${t("meeting.openChat")} (${chatUnreadLabel})`
              : t("meeting.openChat")
          }
          className="relative grid h-12 w-full place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background sm:size-12"
          disabled={!canChat}
          onClick={onToggleChat}
          title={canChat ? t("meeting.openChat") : t("meeting.chat")}
          type="button"
        >
          <MessageSquare className="size-5" />
          {chatUnreadCount > 0 ? (
            <span className="absolute -end-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full border border-surface bg-danger px-1 text-[10px] font-bold leading-none text-danger-foreground shadow-sm">
              {chatUnreadLabel}
            </span>
          ) : null}
        </button>
        <button
          aria-label={t("meeting.toggleSettings")}
          className="grid h-12 w-full place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted sm:size-12"
          onClick={onOpenSettings}
          title={t("meeting.toggleSettings")}
          type="button"
        >
          <Settings className="size-5" />
        </button>
        <button
          aria-label={t("meeting.leave")}
          className="grid h-12 w-full place-items-center rounded-md bg-danger text-danger-foreground transition hover:bg-danger/90 sm:size-12"
          onClick={onLeave}
          title={t("meeting.leave")}
          type="button"
        >
          <Phone className="size-5 rotate-[135deg]" />
        </button>
      </footer>
      {reactionPicker}
    </>
  );
}
