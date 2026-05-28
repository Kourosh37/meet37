"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdmissionModal } from "@/features/meeting/components/AdmissionModal";
import { ChatPanel } from "@/features/meeting/components/ChatPanel";
import { ControlBar } from "@/features/meeting/components/ControlBar";
import { ParticipantsPanel } from "@/features/meeting/components/ParticipantsPanel";
import { SettingsDrawer } from "@/features/meeting/components/SettingsDrawer";
import { SFUBanner } from "@/features/meeting/components/SFUBanner";
import { VideoGrid } from "@/features/meeting/components/VideoGrid";
import { useLocalMedia } from "@/features/meeting/hooks/useLocalMedia";
import { useModeration } from "@/features/meeting/hooks/useModeration";
import { usePeerConnections } from "@/features/meeting/hooks/usePeerConnections";
import { useWebSocket } from "@/features/meeting/hooks/useWebSocket";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import type { MeetingPeer } from "@/features/meeting/types/peer";
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
  const startLocalMedia = localMedia.start;
  const stopLocalMedia = localMedia.stop;
  const audioEnabled = localMedia.audioEnabled;
  const toggleAudio = localMedia.toggleAudio;
  const { remoteStreams } = usePeerConnections(localMedia.stream);
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sfuActive = Object.values(meeting.peers).some(
    (peer) => peer.connection.mode === "sfu"
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
          screenSharing: localMedia.screenSharing,
          videoEnabled: localMedia.videoEnabled
        }
      }) satisfies MeetingPeer,
    [
      displayName,
      localMedia.audioEnabled,
      localMedia.screenSharing,
      localMedia.videoEnabled,
      meeting.isHost,
      meeting.localPeerId
    ]
  );

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

  function handleLeave() {
    stopLocalMedia();
    websocket.close();
    meeting.reset();
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
    <main className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
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

      <SFUBanner active={sfuActive} />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <VideoGrid
          local={{
            audioEnabled: localMedia.audioEnabled,
            displayName,
            isHost: meeting.isHost,
            screenSharing: localMedia.screenSharing,
            stream: localMedia.stream,
            videoEnabled: localMedia.videoEnabled
          }}
          peers={meeting.peers}
          remoteStreams={remoteStreams}
        />

        {participantsOpen ? (
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
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onToggleAudio={localMedia.toggleAudio}
        onToggleVideo={localMedia.toggleVideo}
        videoEnabled={localMedia.videoEnabled}
      />
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        roomId={meeting.roomId}
      />
      <ControlBar
        audioEnabled={localMedia.audioEnabled}
        onCopyInvite={() => void handleCopyInvite()}
        onLeave={handleLeave}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleAudio={localMedia.toggleAudio}
        onToggleChat={() => setChatOpen((open) => !open)}
        onToggleParticipants={() => setParticipantsOpen((open) => !open)}
        onToggleVideo={localMedia.toggleVideo}
        participantsOpen={participantsOpen}
        videoEnabled={localMedia.videoEnabled}
      />
    </main>
  );
}

export default MeetingRoom;
