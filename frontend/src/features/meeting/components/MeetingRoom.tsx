"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdmissionModal } from "@/features/meeting/components/AdmissionModal";
import { ChatPanel } from "@/features/meeting/components/ChatPanel";
import { ControlBar } from "@/features/meeting/components/ControlBar";
import { ParticipantsPanel } from "@/features/meeting/components/ParticipantsPanel";
import { SettingsDrawer } from "@/features/meeting/components/SettingsDrawer";
import { VideoGrid } from "@/features/meeting/components/VideoGrid";
import { useLocalMedia } from "@/features/meeting/hooks/useLocalMedia";
import { useModeration } from "@/features/meeting/hooks/useModeration";
import { usePeerConnections } from "@/features/meeting/hooks/usePeerConnections";
import { useQualityStats } from "@/features/meeting/hooks/useQualityStats";
import { useSFUConnection } from "@/features/meeting/hooks/useSFUConnection";
import { useWebSocket } from "@/features/meeting/hooks/useWebSocket";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import { useMeetingUiStore } from "@/features/meeting/stores/uiStore";
import type { MeetingPeer } from "@/features/meeting/types/peer";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

interface MeetingRoomProps {
  displayName: string;
  roomName?: string;
}

export function MeetingRoom({ displayName, roomName }: MeetingRoomProps) {
  const router = useRouter();
  const meeting = useMeetingStore();
  const websocket = useWebSocket();
  const localMedia = useLocalMedia();
  const moderation = useModeration();
  const onlineStatus = useOnlineStatus();
  const ui = useMeetingUiStore();
  const startLocalMedia = localMedia.start;
  const stopLocalMedia = localMedia.stop;
  const audioEnabled = localMedia.audioEnabled;
  const toggleAudio = localMedia.toggleAudio;
  const peerConnections = usePeerConnections(localMedia.stream);
  const sfu = useSFUConnection(localMedia.stream);
  useQualityStats(peerConnections.connections);
  const remoteStreams = useMemo(
    () => ({
      ...peerConnections.remoteStreams,
      ...sfu.remoteStreams
    }),
    [peerConnections.remoteStreams, sfu.remoteStreams]
  );
  const localPeer = useMemo(
    () =>
      ({
        connection: {
          mode: "p2p",
          quality: "unknown"
        },
        displayName,
        id: meeting.localPeerId ?? "local",
        isHost: meeting.isHost,
        media: {
          audioEnabled: localMedia.audioEnabled,
          audioStatus: localMedia.audioStatus,
          screenSharing: localMedia.screenSharing,
          screenShareStatus: localMedia.screenShareStatus,
          videoStatus: localMedia.videoStatus,
          videoEnabled: localMedia.videoEnabled
        }
      }) satisfies MeetingPeer,
    [
      displayName,
      localMedia.audioEnabled,
      localMedia.audioStatus,
      localMedia.screenSharing,
      localMedia.screenShareStatus,
      localMedia.videoEnabled,
      localMedia.videoStatus,
      meeting.isHost,
      meeting.localPeerId
    ]
  );
  const shortcuts = useMemo(
    () => [
      { handler: localMedia.toggleAudio, key: "m" },
      { handler: localMedia.toggleVideo, key: "v" },
      { handler: localMedia.toggleScreenShare, key: "s" },
      { handler: () => ui.togglePanel("chat"), key: "c" },
      { handler: () => ui.togglePanel("participants"), key: "p" }
    ],
    [
      localMedia.toggleAudio,
      localMedia.toggleScreenShare,
      localMedia.toggleVideo,
      ui
    ]
  );

  useKeyboard(shortcuts, meeting.phase === "in-call");

  useEffect(() => {
    void startLocalMedia();

    return () => {
      stopLocalMedia();
    };
  }, [startLocalMedia, stopLocalMedia]);

  useEffect(() => {
    return webSocketManager.subscribe("mute-request", (message) => {
      if (message.payload.kind === "audio" && audioEnabled) {
        toggleAudio();
        toast.info("The host requested that your microphone be muted.");
      }
    });
  }, [audioEnabled, toggleAudio]);

  useEffect(() => {
    if (meeting.phase !== "in-call") {
      return;
    }

    webSocketManager.send({
      payload: {
        audio_enabled: localMedia.audioEnabled,
        audio_status: localMedia.audioStatus,
        screen_sharing: localMedia.screenSharing,
        screen_share_status: localMedia.screenShareStatus,
        video_enabled: localMedia.videoEnabled,
        video_status: localMedia.videoStatus
      },
      type: "media-state"
    });
  }, [
    localMedia.audioEnabled,
    localMedia.audioStatus,
    localMedia.screenSharing,
    localMedia.screenShareStatus,
    localMedia.videoEnabled,
    localMedia.videoStatus,
    meeting.phase
  ]);

  function handleLeave() {
    stopLocalMedia();
    websocket.close();
    meeting.reset();
    ui.reset();
    router.push("/");
  }

  async function handleCopyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy invite link");
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-7xl flex-col gap-4 border-x border-border px-4 py-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {websocket.status === "open" ? "Connected" : websocket.status}
          </p>
          <h1 className="truncate text-lg font-semibold tracking-normal text-surface-foreground">
            {roomName ?? "Meeting room"}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{Object.keys(meeting.peers).length + 1} participants</span>
        </div>
      </header>

      {localMedia.error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {localMedia.error}
        </div>
      ) : null}

      {onlineStatus.isOffline ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
          You are offline. Signaling and media may reconnect when your network
          returns.
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <VideoGrid
          local={{
            audioEnabled: localMedia.audioEnabled,
            audioStatus: localMedia.audioStatus,
            displayName,
            isHost: meeting.isHost,
            screenSharing: localMedia.screenSharing,
            screenShareStatus: localMedia.screenShareStatus,
            stream: localMedia.stream,
            videoStatus: localMedia.videoStatus,
            videoEnabled: localMedia.videoEnabled
          }}
          peers={meeting.peers}
          remoteStreams={remoteStreams}
        />

        {ui.participantsOpen ? (
          <ParticipantsPanel
            canModerate={moderation.canModerate}
            localPeer={localPeer}
            onApprove={moderation.approvePeer}
            onKick={moderation.kickPeer}
            onMute={moderation.mutePeer}
            onReject={moderation.rejectPeer}
            peers={meeting.peers}
            pendingPeers={moderation.pendingPeers}
          />
        ) : null}
      </div>

      <AdmissionModal
        onApprove={moderation.approvePeer}
        onReject={moderation.rejectPeer}
        pendingPeers={moderation.pendingPeers}
      />
      <SettingsDrawer
        audioEnabled={localMedia.audioEnabled}
        isOpen={ui.settingsOpen}
        onClose={() => ui.closePanel("settings")}
        onToggleAudio={localMedia.toggleAudio}
        onToggleScreenShare={localMedia.toggleScreenShare}
        onToggleVideo={localMedia.toggleVideo}
        screenSharing={localMedia.screenSharing}
        videoEnabled={localMedia.videoEnabled}
      />
      <ChatPanel
        isOpen={ui.chatOpen}
        onClose={() => ui.closePanel("chat")}
        roomId={meeting.roomId}
      />
      <ControlBar
        audioEnabled={localMedia.audioEnabled}
        onCopyInvite={() => void handleCopyInvite()}
        onLeave={handleLeave}
        onOpenSettings={() => ui.openPanel("settings")}
        onToggleAudio={localMedia.toggleAudio}
        onToggleChat={() => ui.togglePanel("chat")}
        onToggleParticipants={() => ui.togglePanel("participants")}
        onToggleScreenShare={localMedia.toggleScreenShare}
        onToggleVideo={localMedia.toggleVideo}
        participantsOpen={ui.participantsOpen}
        screenSharing={localMedia.screenSharing}
        videoEnabled={localMedia.videoEnabled}
      />
    </main>
  );
}

export default MeetingRoom;
