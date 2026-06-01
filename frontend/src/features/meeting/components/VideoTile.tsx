"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  MonitorUp,
  VideoOff
} from "lucide-react";
import type {
  MediaTrackStatus,
  PeerMode
} from "@/features/meeting/types/signaling";
import { useAudioLevel } from "@/features/meeting/hooks/useAudioLevel";
import { cn } from "@/lib/utils/cn";

interface VideoTileProps {
  audioEnabled?: boolean;
  audioLevel?: number;
  audioStatus?: MediaTrackStatus;
  className?: string;
  displayName: string;
  isHost?: boolean;
  isLocal?: boolean;
  mode?: PeerMode;
  onMaximize?: () => void;
  screenSharing?: boolean;
  screenShareStatus?: MediaTrackStatus;
  stream: MediaStream | null;
  videoEnabled?: boolean;
  videoStatus?: MediaTrackStatus;
}

export function VideoTile({
  audioEnabled = true,
  audioLevel: signaledAudioLevel,
  audioStatus = audioEnabled ? "ready" : "off",
  className,
  displayName,
  isHost = false,
  isLocal = false,
  onMaximize,
  screenSharing = false,
  screenShareStatus = screenSharing ? "starting" : "off",
  stream,
  videoEnabled = true,
  videoStatus = videoEnabled ? "starting" : "off"
}: VideoTileProps) {
  const [_trackVersion, setTrackVersion] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioTracks = useMemo(() => stream?.getAudioTracks() ?? [], [stream]);
  const videoTracks = useMemo(() => stream?.getVideoTracks() ?? [], [stream]);
  const audioStream = useMemo(
    () => (audioTracks.length ? new MediaStream(audioTracks) : null),
    [audioTracks]
  );
  const videoStream = useMemo(
    () => (videoTracks.length ? new MediaStream(videoTracks) : null),
    [videoTracks]
  );
  const hasAudio = audioTracks.some(
    (track) => track.readyState === "live" && !track.muted
  );
  const hasVideo = Boolean(
    videoTracks.some((track) => track.readyState === "live" && !track.muted) &&
      (videoEnabled || screenSharing)
  );
  const isOpeningScreenShare = screenSharing && !hasVideo;
  const isCameraExpected = !screenSharing && videoEnabled && !hasVideo;
  const loadingLabel = isOpeningScreenShare
    ? screenShareStatus === "error"
      ? "Shared screen unavailable"
      : "Opening shared screen"
    : isCameraExpected
      ? videoStatus === "error"
        ? "Camera unavailable"
        : "Opening camera"
      : null;
  const isOpeningMicrophone = audioEnabled && audioStatus === "starting";
  const hasMicrophoneError = audioEnabled && audioStatus === "error";
  const measuredAudioLevel = useAudioLevel(
    signaledAudioLevel === undefined ? audioStream : null,
    audioEnabled && hasAudio,
    0.74
  );
  const audioLevel = signaledAudioLevel ?? measuredAudioLevel;
  const isSpeaking = audioEnabled && !hasMicrophoneError && audioLevel > 0.08;
  const speakingScale = 1 + Math.min(audioLevel, 1) * 0.25;
  const speakingOpacity = Math.min(0.95, 0.25 + audioLevel * 1.8);
  const initials = useMemo(
    () =>
      displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "?",
    [displayName]
  );

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = hasVideo ? videoStream : null;
      if (hasVideo) {
        void videoRef.current.play().catch(() => undefined);
      }
    }
  }, [hasVideo, videoStream]);

  useEffect(() => {
    const updateTrackState = () => setTrackVersion((version) => version + 1);

    [...audioTracks, ...videoTracks].forEach((track) => {
      track.addEventListener("ended", updateTrackState);
      track.addEventListener("mute", updateTrackState);
      track.addEventListener("unmute", updateTrackState);
    });

    return () => {
      [...audioTracks, ...videoTracks].forEach((track) => {
        track.removeEventListener("ended", updateTrackState);
        track.removeEventListener("mute", updateTrackState);
        track.removeEventListener("unmute", updateTrackState);
      });
    };
  }, [audioTracks, videoTracks]);

  useEffect(() => {
    if (!audioRef.current || isLocal) {
      return;
    }

    const audio = audioRef.current;
    const playAudio = () => {
      if (!hasAudio) {
        return;
      }

      audio.muted = false;
      audio.volume = 1;
      void audio.play().catch(() => undefined);
    };

    audio.srcObject = hasAudio ? audioStream : null;
    playAudio();

    window.addEventListener("click", playAudio);
    window.addEventListener("keydown", playAudio);
    window.addEventListener("pointerdown", playAudio);
    audio.addEventListener("canplay", playAudio);
    audio.addEventListener("loadedmetadata", playAudio);

    return () => {
      window.removeEventListener("click", playAudio);
      window.removeEventListener("keydown", playAudio);
      window.removeEventListener("pointerdown", playAudio);
      audio.removeEventListener("canplay", playAudio);
      audio.removeEventListener("loadedmetadata", playAudio);
      audio.srcObject = null;
    };
  }, [audioStream, hasAudio, isLocal]);

  return (
    <article
      className={cn(
        "relative grid aspect-video min-h-[clamp(150px,48vw,240px)] overflow-hidden rounded-lg border border-border bg-black shadow-sm transition-[border-color,box-shadow] sm:min-h-[180px]",
        isSpeaking &&
          "border-primary shadow-[0_0_0_2px_rgb(var(--primary)/0.35)]",
        className
      )}
    >
      {!isLocal ? <audio ref={audioRef} autoPlay playsInline /> : null}

      {onMaximize ? (
        <button
          aria-label={`Maximize ${displayName}`}
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-md border border-white/20 bg-black/55 text-white shadow-sm transition hover:bg-black/75"
          onClick={onMaximize}
          title="Maximize"
          type="button"
        >
          <Maximize2 className="size-4" />
        </button>
      ) : null}

      {!hasVideo && !loadingLabel ? (
        <VideoOff
          className="absolute left-3 top-3 z-10 h-5 w-5 text-white/80"
          aria-hidden="true"
        />
      ) : null}

      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          className={cn(
            "h-full w-full object-contain",
            isLocal && "scale-x-[-1]"
          )}
          muted
          playsInline
        />
      ) : loadingLabel ? (
        <div className="grid place-items-center bg-muted text-muted-foreground">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-surface-foreground">
              {loadingLabel}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid place-items-center bg-muted text-muted-foreground">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-surface text-2xl font-semibold text-surface-foreground shadow-sm">
            {initials}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex min-h-14 items-end justify-between gap-3 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {displayName}
            {isLocal ? " (You)" : ""}
          </p>
          <p className="text-xs text-white/75">{isHost ? "Host" : "Guest"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {screenSharing ? (
            <MonitorUp className="h-4 w-4" aria-label="Screen sharing" />
          ) : null}
          {isOpeningMicrophone ? (
            <Loader2
              className="h-4 w-4 animate-spin"
              aria-label="Opening microphone"
            />
          ) : audioEnabled && !hasMicrophoneError ? (
            <span
              className={cn(
                "relative grid size-7 place-items-center rounded-full border border-white/15 bg-white/10 transition",
                isSpeaking &&
                  "border-primary bg-primary text-primary-foreground"
              )}
              style={
                isSpeaking
                  ? {
                      boxShadow: `0 0 0 ${Math.round(4 + audioLevel * 12)}px rgb(var(--primary) / ${speakingOpacity * 0.2}), 0 0 ${Math.round(12 + audioLevel * 18)}px rgb(var(--primary) / ${speakingOpacity * 0.28})`,
                      transform: `scale(${speakingScale})`
                    }
                  : undefined
              }
            >
              <Mic
                className={cn("h-4 w-4", isSpeaking && "text-current")}
                aria-label={isSpeaking ? "Speaking" : "Microphone on"}
              />
            </span>
          ) : (
            <MicOff
              className="h-4 w-4 text-danger"
              aria-label={
                hasMicrophoneError ? "Microphone unavailable" : "Microphone off"
              }
            />
          )}
        </div>
      </div>
    </article>
  );
}
