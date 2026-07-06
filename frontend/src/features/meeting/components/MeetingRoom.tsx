"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InlineError } from "@/components/feedback/InlineError";
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
import { useP2PConnections } from "@/features/meeting/hooks/useP2PConnections";
import { useQualityStats } from "@/features/meeting/hooks/useQualityStats";
import { useSFUConnection } from "@/features/meeting/hooks/useSFUConnection";
import { useWebSocket } from "@/features/meeting/hooks/useWebSocket";
import { useWebSocketPing } from "@/features/meeting/hooks/useWebSocketPing";
import { useChatStore } from "@/features/meeting/stores/chatStore";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import { useMeetingUiStore } from "@/features/meeting/stores/uiStore";
import type { MeetingPeer } from "@/features/meeting/types/peer";
import type { JoinPolicy } from "@/types/api";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { playUiSound } from "@/lib/audio/uiSounds";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";
import { useLocale } from "@/providers/LocaleProvider";

interface MeetingRoomProps {
  displayName: string;
  roomJoinPolicy?: JoinPolicy;
  roomName?: string;
}

export function MeetingRoom({
  displayName,
  roomJoinPolicy = "open",
  roomName
}: MeetingRoomProps) {
  const router = useRouter();
  const meetingScrollRef = useRef<HTMLDivElement | null>(null);
  const participantsSectionRef = useRef<HTMLDivElement | null>(null);
  const topScrollAnimationFrameRef = useRef<number | null>(null);
  const topScrollSettleFrameRef = useRef<number | null>(null);
  const meeting = useMeetingStore();
  const chatUnreadCount = useChatStore((state) => state.unreadCount);
  const websocket = useWebSocket();
  const { t } = useLocale();
  const pingMs = useWebSocketPing(websocket.status === "open");
  const localMedia = useLocalMedia();
  const moderation = useModeration();
  const onlineStatus = useOnlineStatus();
  const ui = useMeetingUiStore();
  const startLocalMedia = localMedia.start;
  const stopLocalMedia = localMedia.stop;
  const audioEnabled = localMedia.audioEnabled;
  const screenSharing = localMedia.screenSharing;
  const toggleAudio = localMedia.toggleAudio;
  const toggleScreenShare = localMedia.toggleScreenShare;
  const toggleVideo = localMedia.toggleVideo;
  const videoEnabled = localMedia.videoEnabled;
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
  const [currentJoinPolicy, setCurrentJoinPolicy] =
    useState<JoinPolicy>(roomJoinPolicy);
  const peerIds = useMemo(
    () => Object.keys(meeting.peers).sort().join(","),
    [meeting.peers]
  );
  const sfu = useSFUConnection(localMedia.stream, {
    enabled:
      meeting.phase === "in-call" &&
      websocket.status === "open" &&
      meeting.roomMode === "sfu" &&
      Boolean(meeting.localPeerId),
    turnServers: meeting.turnServers ?? []
  });
  const p2p = useP2PConnections(localMedia.stream, {
    enabled:
      meeting.phase === "in-call" &&
      websocket.status === "open" &&
      meeting.roomMode === "p2p" &&
      Boolean(meeting.localPeerId),
    localPeerId: meeting.localPeerId,
    peers: meeting.peers,
    turnServers: meeting.turnServers ?? []
  });
  const localPermissions = meeting.localPermissions;
  const canUseMic = localPermissions?.can_use_mic ?? true;
  const canUseCamera = localPermissions?.can_use_camera ?? true;
  const canShareScreen = localPermissions?.can_share_screen ?? true;
  const canChat = localPermissions?.can_chat ?? true;
  const canReact = localPermissions?.can_react ?? true;
  const activeConnections =
    meeting.roomMode === "sfu" ? sfu.connections : p2p.connections;
  const connectionQuality = useQualityStats(activeConnections);
  const remoteStreams =
    meeting.roomMode === "sfu" ? sfu.remoteStreams : p2p.remoteStreams;
  const localPeer = useMemo(
    () =>
      ({
        connection: {
          mode: meeting.roomMode,
          quality: "unknown"
        },
        displayName,
        id: meeting.localPeerId ?? "local",
        isHost: meeting.isHost,
        isAdmin: meeting.isAdmin,
        permissions: meeting.localPermissions,
        adminPermissions: meeting.localAdminPermissions,
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
      meeting.isAdmin,
      meeting.isHost,
      meeting.localAdminPermissions,
      meeting.localPermissions,
      meeting.localPeerId,
      meeting.roomMode
    ]
  );
  const shortcuts = useMemo(
    () => [
      {
        handler: () => {
          if (audioEnabled || canUseMic) {
            toggleAudio();
          }
        },
        key: "m"
      },
      {
        handler: () => {
          if (videoEnabled || canUseCamera) {
            toggleVideo();
          }
        },
        key: "v"
      },
      {
        handler: () => {
          if (screenSharing || canShareScreen) {
            toggleScreenShare();
          }
        },
        key: "s"
      },
      {
        handler: () => {
          if (canChat) {
            ui.togglePanel("chat");
          }
        },
        key: "c"
      }
    ],
    [
      canChat,
      canShareScreen,
      canUseCamera,
      canUseMic,
      audioEnabled,
      screenSharing,
      toggleAudio,
      toggleScreenShare,
      toggleVideo,
      videoEnabled,
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
        toast.info(t("meeting.micMuteRequested"));
      }
      if (message.payload.kind === "video" && localMedia.videoEnabled) {
        localMedia.toggleVideo();
        toast.info(t("meeting.cameraDisabled"));
      }
      if (message.payload.kind === "screen" && localMedia.screenSharing) {
        localMedia.toggleScreenShare();
        toast.info(t("meeting.screenShareDisabled"));
      }
    });
  }, [audioEnabled, localMedia, t, toggleAudio]);

  useEffect(() => {
    if (!canUseMic && localMedia.audioEnabled) {
      localMedia.toggleAudio();
      toast.info(t("meeting.microphonePermissionDisabled"));
    }
  }, [canUseMic, localMedia, t]);

  useEffect(() => {
    if (!canUseCamera && localMedia.videoEnabled) {
      localMedia.toggleVideo();
      toast.info(t("meeting.cameraPermissionDisabled"));
    }
  }, [canUseCamera, localMedia, t]);

  useEffect(() => {
    if (!canShareScreen && localMedia.screenSharing) {
      localMedia.toggleScreenShare();
      toast.info(t("meeting.screenSharePermissionDisabled"));
    }
  }, [canShareScreen, localMedia, t]);

  useEffect(() => {
    if (!canChat && ui.chatOpen) {
      ui.closePanel("chat");
    }
  }, [canChat, ui]);

  useEffect(() => {
    setCurrentJoinPolicy(roomJoinPolicy);
  }, [roomJoinPolicy]);

  useEffect(() => {
    return webSocketManager.subscribe("room-settings-updated", (message) => {
      if (message.payload.join_policy) {
        setCurrentJoinPolicy(message.payload.join_policy);
      }
    });
  }, []);

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

  useEffect(
    () => () => {
      cancelMeetingScrollAnimation();
    },
    []
  );

  function handleLeave() {
    playUiSound("callEnd");
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
        drift: Math.round(Math.random() * 120 - 60),
        emoji,
        id,
        name,
        rotate: Math.round(Math.random() * 28 - 14),
        x: Math.round(24 + Math.random() * 52)
      }
    ]);
  }, []);

  const removeReaction = useCallback((id: string) => {
    setReactions((current) => current.filter((reaction) => reaction.id !== id));
  }, []);

  const handleReaction = useCallback(
    (emoji: string) => {
      if (!canReact) {
        toast.info(t("meeting.emojiDisabled"));
        return;
      }
      addReaction(emoji, displayName);
      playUiSound("reaction");
      webSocketManager.send({ payload: { emoji }, type: "reaction" });
    },
    [addReaction, canReact, displayName, t]
  );

  useEffect(() => {
    return webSocketManager.subscribe("reaction", (message) => {
      if (!message.payload.emoji) {
        return;
      }
      const senderName =
        message.payload.display_name ??
        (message.from ? meeting.peers[message.from]?.displayName : undefined) ??
        t("common.guest");
      addReaction(message.payload.emoji, senderName);
      playUiSound("reaction");
    });
  }, [addReaction, meeting.peers, t]);

  async function handleCopyInvite() {
    const inviteUrl = window.location.href;
    const copyWithFallback = () => {
      const textarea = document.createElement("textarea");
      textarea.value = inviteUrl;
      textarea.setAttribute("readonly", "true");
      textarea.style.left = "-9999px";
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (!copied) {
        throw new Error("Copy command failed");
      }
    };

    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(inviteUrl);
        } catch {
          copyWithFallback();
        }
      } else {
        copyWithFallback();
      }
      toast.success(t("meeting.copyInviteSuccess"));
    } catch {
      toast.error(t("meeting.copyInviteFailed"));
    }
  }

  function cancelMeetingScrollAnimation() {
    if (topScrollAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(topScrollAnimationFrameRef.current);
      topScrollAnimationFrameRef.current = null;
    }
    if (topScrollSettleFrameRef.current !== null) {
      window.cancelAnimationFrame(topScrollSettleFrameRef.current);
      topScrollSettleFrameRef.current = null;
    }
  }

  function animateMeetingScrollTo(
    targetTop: number,
    { settle = false }: { settle?: boolean } = {}
  ) {
    const scroller = meetingScrollRef.current;

    if (!scroller) {
      window.scrollTo({ behavior: "smooth", top: targetTop });
      return;
    }

    const scrollElement = scroller;
    const maxTop = Math.max(
      0,
      scrollElement.scrollHeight - scrollElement.clientHeight
    );
    const finalTop = Math.min(Math.max(0, Math.round(targetTop)), maxTop);
    const startTop = scrollElement.scrollTop;
    const distance = finalTop - startTop;
    const durationMs = Math.min(420, Math.max(220, Math.abs(distance) * 0.45));
    const startedAt = performance.now();

    cancelMeetingScrollAnimation();
    scrollElement.style.setProperty("overflow-anchor", "none");

    function settleAtTarget(settleStartedAt: number) {
      scrollElement.scrollTop = finalTop;

      if (performance.now() - settleStartedAt < 520) {
        topScrollSettleFrameRef.current = window.requestAnimationFrame(() =>
          settleAtTarget(settleStartedAt)
        );
        return;
      }

      topScrollSettleFrameRef.current = null;
    }

    if (Math.abs(distance) <= 1) {
      scrollElement.scrollTop = finalTop;
      if (settle) {
        settleAtTarget(performance.now());
      }
      return;
    }

    function animate(now: number) {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      scrollElement.scrollTop = Math.round(startTop + distance * eased);

      if (progress < 1) {
        topScrollAnimationFrameRef.current =
          window.requestAnimationFrame(animate);
        return;
      }

      topScrollAnimationFrameRef.current = null;
      scrollElement.scrollTop = finalTop;
      if (settle) {
        settleAtTarget(performance.now());
      }
    }

    topScrollAnimationFrameRef.current = window.requestAnimationFrame(animate);
  }

  function scrollToParticipants() {
    ui.openPanel("participants");
    window.setTimeout(() => {
      const scroller = meetingScrollRef.current;
      const participantsSection = participantsSectionRef.current;

      if (!scroller || !participantsSection) {
        return;
      }

      const targetTop =
        scroller.scrollTop +
        participantsSection.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top;

      animateMeetingScrollTo(targetTop);
    }, 0);
  }

  function scrollToMeetingTop() {
    animateMeetingScrollTo(0, { settle: true });
  }

  return (
    <main className="mx-auto flex h-[100svh] w-full max-w-7xl flex-col overflow-hidden border-x border-border">
      <MeetingHeader
        connectionQuality={connectionQuality}
        isConnected={websocket.status === "open"}
        participantCount={Object.keys(meeting.peers).length + 1}
        pingMs={pingMs}
        roomId={meeting.roomId ?? undefined}
        roomName={roomName}
        statusLabel={
          meeting.phase === "reconnecting"
            ? t("common.reconnecting")
            : websocket.status === "open"
              ? t("common.connected")
              : websocket.status
        }
      />

      <div
        className="min-h-0 flex-1 overflow-y-auto pb-32 pt-[69px] [overflow-anchor:none] lg:pt-24"
        ref={meetingScrollRef}
      >
        <div className="flex min-h-full flex-col gap-3 px-4 sm:px-6 lg:gap-4">
          <InlineError
            className="rounded-lg px-4 py-3"
            message={localMedia.error}
          />

          {onlineStatus.isOffline ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
              {t("meeting.youAreOffline")}
            </div>
          ) : null}

          <button
            className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-surface-foreground shadow-sm transition hover:bg-muted lg:hidden"
            onClick={scrollToParticipants}
            type="button"
          >
            {t("meeting.goToParticipants")}
          </button>

          <div className="grid min-h-0 flex-1 items-start overflow-hidden rounded-lg border border-border bg-border p-px lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
            <VideoGrid
              local={{
                audioEnabled: localMedia.audioEnabled,
                audioLevel: localAudioLevel,
                audioStatus: localMedia.audioStatus,
                displayName,
                isHost: meeting.isHost,
                mode: meeting.roomMode,
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
              <div className="min-h-0 lg:h-full" ref={participantsSectionRef}>
                <ParticipantsPanel
                  className="rounded-none border-0 border-t border-border shadow-none lg:rounded-lg lg:border lg:shadow-sm"
                  canAssignAdmin={meeting.isHost}
                  canKick={moderation.canKick}
                  canModerate={moderation.canModerate}
                  localPeer={localPeer}
                  onApprove={moderation.approvePeer}
                  onApproveAll={moderation.approveAllPeers}
                  onGoToTop={scrollToMeetingTop}
                  onKick={moderation.kickPeer}
                  onReject={moderation.rejectPeer}
                  onSetAdminPermissions={moderation.setAdminPermissions}
                  onSetPeerPermissions={moderation.setPeerPermissions}
                  peers={meeting.peers}
                  pendingPeers={moderation.pendingPeers}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <RemoteAudioPlayer streams={remoteStreams} />
      <ReactionOverlay onDone={removeReaction} reactions={reactions} />

      <AdmissionModal
        onApprove={moderation.approvePeer}
        onApproveAll={moderation.approveAllPeers}
        onReject={moderation.rejectPeer}
        pendingPeers={moderation.pendingPeers}
      />
      <SettingsDrawer
        bannedParticipants={moderation.bannedParticipants}
        canManageBans={moderation.canManageBans}
        joinPolicy={currentJoinPolicy}
        isHost={meeting.isHost}
        isOpen={ui.settingsOpen}
        onClose={() => ui.closePanel("settings")}
        onListBans={moderation.listBans}
        onUnbanPeer={moderation.unbanPeer}
        onUpdateRoomSettings={moderation.updateRoomSettings}
      />
      <ChatPanel
        isOpen={ui.chatOpen && canChat}
        onClose={() => ui.closePanel("chat")}
        roomId={meeting.roomId}
      />
      <ControlBar
        audioEnabled={localMedia.audioEnabled}
        audioInputs={localMedia.audioInputs}
        canChat={canChat}
        canReact={canReact}
        canShareScreen={canShareScreen}
        canUseCamera={canUseCamera}
        canUseMic={canUseMic}
        chatUnreadCount={chatUnreadCount}
        onCopyInvite={() => void handleCopyInvite()}
        onLeave={handleLeave}
        onOpenSettings={() => ui.togglePanel("settings")}
        onReaction={handleReaction}
        onSelectAudioDevice={localMedia.setSelectedAudioDeviceId}
        onSelectVideoDevice={localMedia.setSelectedVideoDeviceId}
        onToggleAudio={() => {
          if (localMedia.audioEnabled || canUseMic) {
            localMedia.toggleAudio();
          }
        }}
        onToggleChat={() => {
          if (canChat) {
            ui.togglePanel("chat");
          }
        }}
        onToggleScreenShare={() => {
          if (localMedia.screenSharing || canShareScreen) {
            localMedia.toggleScreenShare();
          }
        }}
        onToggleVideo={() => {
          if (localMedia.videoEnabled || canUseCamera) {
            localMedia.toggleVideo();
          }
        }}
        screenSharing={localMedia.screenSharing}
        screenShareSupported={localMedia.screenShareSupported}
        screenShareUnavailableReason={localMedia.screenShareUnavailableReason}
        selectedAudioDeviceId={localMedia.selectedAudioDeviceId}
        selectedVideoDeviceId={localMedia.selectedVideoDeviceId}
        videoEnabled={localMedia.videoEnabled}
        videoInputs={localMedia.videoInputs}
      />
    </main>
  );
}

export default MeetingRoom;
