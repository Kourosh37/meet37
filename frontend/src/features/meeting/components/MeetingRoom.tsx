"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdmissionModal } from "@/features/meeting/components/AdmissionModal";
import { ChatPanel } from "@/features/meeting/components/ChatPanel";
import { ControlBar } from "@/features/meeting/components/ControlBar";
import { MeetingHeader } from "@/features/meeting/components/MeetingHeader";
import { ParticipantsPanel } from "@/features/meeting/components/ParticipantsPanel";
import {
  ReactionOverlay,
  type FloatingReaction
} from "@/features/meeting/components/ReactionOverlay";
import { RemoteAudioPlayer } from "@/features/meeting/components/RemoteAudioPlayer";
import { SettingsDrawer } from "@/features/meeting/components/SettingsDrawer";
import { VideoGrid } from "@/features/meeting/components/VideoGrid";
import { useLocalMedia } from "@/features/meeting/hooks/useLocalMedia";
import { useAudioLevel } from "@/features/meeting/hooks/useAudioLevel";
import { useModeration } from "@/features/meeting/hooks/useModeration";
import { usePeerConnections } from "@/features/meeting/hooks/usePeerConnections";
import { useQualityStats } from "@/features/meeting/hooks/useQualityStats";
import { useSFUConnection } from "@/features/meeting/hooks/useSFUConnection";
import { useWebSocket } from "@/features/meeting/hooks/useWebSocket";
import { useWebSocketPing } from "@/features/meeting/hooks/useWebSocketPing";
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
  const pingMs = useWebSocketPing(websocket.status === "open");
  const localMedia = useLocalMedia();
  const moderation = useModeration();
  const onlineStatus = useOnlineStatus();
  const ui = useMeetingUiStore();
  const startLocalMedia = localMedia.start;
  const stopLocalMedia = localMedia.stop;
  const audioEnabled = localMedia.audioEnabled;
  const toggleAudio = localMedia.toggleAudio;
  const localAudioLevel = useAudioLevel(
    localMedia.stream,
    localMedia.audioEnabled && localMedia.audioStatus === "ready",
    0.74
  );
  const localAudioLevelRef = useRef(0);
  const lastSentAudioLevelRef = useRef(0);
  const lastSentAudioLevelAtRef = useRef(0);
  const remoteAudioLevelTimersRef = useRef(new Map<string, number>());
  const [remoteAudioLevels, setRemoteAudioLevels] = useState<
    Record<string, number>
  >({});
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const peerIds = useMemo(
    () => Object.keys(meeting.peers).sort().join(","),
    [meeting.peers]
  );
  const peerConnections = usePeerConnections(localMedia.stream);
  const sfu = useSFUConnection(localMedia.stream);
  const connectionQuality = useQualityStats(peerConnections.connections);
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
      { handler: () => ui.togglePanel("chat"), key: "c" }
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
    meeting.phase,
    peerIds
  ]);

  useEffect(() => {
    localAudioLevelRef.current = localAudioLevel;
  }, [localAudioLevel]);

  const sendLiveAudioLevel = useCallback(() => {
    const now = Date.now();
    const level =
      localMedia.audioEnabled && localMedia.audioStatus === "ready"
        ? Number(localAudioLevelRef.current.toFixed(3))
        : 0;
    const lastLevel = lastSentAudioLevelRef.current;
    const elapsed = now - lastSentAudioLevelAtRef.current;
    const isAudible = level > 0.025;
    const shouldSend =
      (isAudible && (Math.abs(lastLevel - level) >= 0.015 || elapsed >= 180)) ||
      (!isAudible && (lastLevel > 0.025 || elapsed >= 700));

    if (!shouldSend) {
      return;
    }

    lastSentAudioLevelRef.current = level;
    lastSentAudioLevelAtRef.current = now;
    webSocketManager.send({
      payload: {
        level
      },
      type: "audio-level"
    });
  }, [localMedia.audioEnabled, localMedia.audioStatus]);

  useEffect(() => {
    if (
      meeting.phase !== "in-call" ||
      !localMedia.audioEnabled ||
      localMedia.audioStatus !== "ready"
    ) {
      return;
    }

    const interval = window.setInterval(sendLiveAudioLevel, 160);
    return () => window.clearInterval(interval);
  }, [
    localMedia.audioEnabled,
    localMedia.audioStatus,
    meeting.phase,
    sendLiveAudioLevel
  ]);

  useEffect(() => {
    if (
      meeting.phase !== "in-call" ||
      localMedia.audioEnabled ||
      localMedia.audioStatus !== "off"
    ) {
      return;
    }

    lastSentAudioLevelRef.current = 0;
    lastSentAudioLevelAtRef.current = Date.now();
    webSocketManager.send({
      payload: { level: 0 },
      type: "audio-level"
    });
  }, [localMedia.audioEnabled, localMedia.audioStatus, meeting.phase]);

  useEffect(() => {
    return webSocketManager.subscribe("audio-level", (message) => {
      const peerId = message.from;

      if (!peerId) {
        return;
      }

      const level = Math.min(1, Math.max(0, message.payload.level));
      setRemoteAudioLevels((current) => {
        if (Math.abs((current[peerId] ?? 0) - level) < 0.02) {
          return current;
        }

        return {
          ...current,
          [peerId]: level
        };
      });

      const existingTimer = remoteAudioLevelTimersRef.current.get(peerId);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }
      remoteAudioLevelTimersRef.current.set(
        peerId,
        window.setTimeout(() => {
          remoteAudioLevelTimersRef.current.delete(peerId);
          setRemoteAudioLevels((current) =>
            current[peerId]
              ? {
                  ...current,
                  [peerId]: 0
                }
              : current
          );
        }, 650)
      );
    });
  }, []);

  useEffect(() => {
    const activePeerIds = new Set(Object.keys(meeting.peers));
    setRemoteAudioLevels((current) => {
      remoteAudioLevelTimersRef.current.forEach((timer, peerId) => {
        if (!activePeerIds.has(peerId)) {
          window.clearTimeout(timer);
          remoteAudioLevelTimersRef.current.delete(peerId);
        }
      });
      const next = Object.fromEntries(
        Object.entries(current).filter(([peerId]) => activePeerIds.has(peerId))
      );

      return Object.keys(next).length === Object.keys(current).length
        ? current
        : next;
    });
  }, [meeting.peers]);

  useEffect(
    () => () => {
      remoteAudioLevelTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      remoteAudioLevelTimersRef.current.clear();
    },
    []
  );

  function handleLeave() {
    stopLocalMedia();
    websocket.close();
    meeting.reset();
    ui.reset();
    router.push("/");
  }

  const addReaction = useCallback((emoji: string, name: string) => {
    const now = Date.now();
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${now}-${Math.random()}`;
    setReactions((current) => [
      ...current.slice(-14),
      {
        drift: Math.round(Math.random() * 180 - 90),
        emoji,
        id,
        name,
        rotate: Math.round(Math.random() * 28 - 14),
        x: Math.round(18 + Math.random() * 64)
      }
    ]);
  }, []);

  const removeReaction = useCallback((id: string) => {
    setReactions((current) => current.filter((reaction) => reaction.id !== id));
  }, []);

  const handleReaction = useCallback(
    (emoji: string) => {
      addReaction(emoji, displayName);
      webSocketManager.send({ payload: { emoji }, type: "reaction" });
    },
    [addReaction, displayName]
  );

  useEffect(() => {
    return webSocketManager.subscribe("reaction", (message) => {
      if (!message.payload.emoji) {
        return;
      }
      const senderName =
        message.payload.display_name ??
        (message.from ? meeting.peers[message.from]?.displayName : undefined) ??
        "Guest";
      addReaction(message.payload.emoji, senderName);
    });
  }, [addReaction, meeting.peers]);

  async function handleCopyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy invite link");
    }
  }

  return (
    <main className="mx-auto flex h-[100svh] w-full max-w-7xl flex-col overflow-hidden border-x border-border px-4 sm:px-6">
      <MeetingHeader
        connectionQuality={connectionQuality}
        isConnected={websocket.status === "open"}
        participantCount={Object.keys(meeting.peers).length + 1}
        pingMs={pingMs}
        roomName={roomName}
        statusLabel={websocket.status === "open" ? "Connected" : websocket.status}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-32 pt-24">
        <div className="flex min-h-full flex-col gap-4">
          {localMedia.error ? (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {localMedia.error}
            </div>
          ) : null}

          {onlineStatus.isOffline ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
              You are offline. Signaling and media may reconnect when your
              network returns.
            </div>
          ) : null}

          <div className="grid min-h-0 flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <VideoGrid
              local={{
                audioEnabled: localMedia.audioEnabled,
                audioLevel: localAudioLevel,
                audioStatus: localMedia.audioStatus,
                displayName,
                isHost: meeting.isHost,
                screenSharing: localMedia.screenSharing,
                screenShareStatus: localMedia.screenShareStatus,
                stream: localMedia.stream,
                videoStatus: localMedia.videoStatus,
                videoEnabled: localMedia.videoEnabled
              }}
              audioLevels={remoteAudioLevels}
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
        </div>
      </div>
      <RemoteAudioPlayer streams={remoteStreams} />
      <ReactionOverlay onDone={removeReaction} reactions={reactions} />

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
        screenShareSupported={localMedia.screenShareSupported}
        screenShareUnavailableReason={localMedia.screenShareUnavailableReason}
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
        onReaction={handleReaction}
        onToggleAudio={localMedia.toggleAudio}
        onToggleChat={() => ui.togglePanel("chat")}
        onToggleScreenShare={localMedia.toggleScreenShare}
        onToggleVideo={localMedia.toggleVideo}
        screenSharing={localMedia.screenSharing}
        screenShareSupported={localMedia.screenShareSupported}
        screenShareUnavailableReason={localMedia.screenShareUnavailableReason}
        videoEnabled={localMedia.videoEnabled}
      />
    </main>
  );
}

export default MeetingRoom;
