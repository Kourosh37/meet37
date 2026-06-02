"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
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
  isMaximized?: boolean;
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
  isMaximized = false,
  onMaximize,
  screenSharing = false,
  screenShareStatus = screenSharing ? "starting" : "off",
  stream,
  videoEnabled = true,
  videoStatus = videoEnabled ? "starting" : "off"
}: VideoTileProps) {
  const [_trackVersion, setTrackVersion] = useState(0);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
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
  const trackAspectRatio = useMemo(() => {
    const settings = videoTracks[0]?.getSettings();
    const width = settings?.width;
    const height = settings?.height;

    return width && height ? width / height : null;
  }, [videoTracks]);
  const activeAspectRatio = videoAspectRatio ?? trackAspectRatio ?? 16 / 9;
  const tileStyle = isMaximized
    ? ({
        "--meet-tile-ratio": String(activeAspectRatio),
        aspectRatio: activeAspectRatio
      } as CSSProperties)
    : undefined;
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
  const hasSignaledAudioLevel = signaledAudioLevel !== undefined;
  const isSpeaking =
    !hasMicrophoneError &&
    audioLevel > 0.06 &&
    (audioEnabled || hasSignaledAudioLevel);
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
      } else {
        setVideoAspectRatio(null);
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

  return (
    <article
      style={tileStyle}
      className={cn(
        "relative grid overflow-hidden rounded-lg border border-border bg-black shadow-sm transition-[border-color,box-shadow,transform]",
        isMaximized
          ? "max-h-[var(--meet-tile-max-h)] w-full max-w-[min(100%,calc(var(--meet-tile-max-h)*var(--meet-tile-ratio)))] min-h-0"
          : "aspect-video min-h-[clamp(150px,48vw,240px)] sm:min-h-[180px]",
        isSpeaking &&
          "border-primary shadow-[0_0_0_2px_rgb(var(--primary)/0.28),0_18px_50px_rgb(var(--primary)/0.16)]",
        className
      )}
    >
      {onMaximize ? (
        <button
          aria-label={`Maximize ${displayName}`}
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-md border border-white/25 bg-primary/35 text-white shadow-sm backdrop-blur-md transition hover:bg-primary/50"
          onClick={onMaximize}
          title="Maximize"
          type="button"
        >
          <Maximize2 className="size-4" />
        </button>
      ) : null}

      {!hasVideo && !loadingLabel ? (
        <span className="absolute left-3 top-3 z-10 grid size-9 place-items-center rounded-md border border-white/20 bg-danger/35 text-white shadow-sm backdrop-blur-md">
          <VideoOff className="h-5 w-5" aria-hidden="true" />
        </span>
      ) : null}

      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          className={cn(
            "h-full w-full object-contain",
            isLocal && !screenSharing && "scale-x-[-1]"
          )}
          muted
          onLoadedMetadata={() => {
            const video = videoRef.current;
            if (video?.videoWidth && video.videoHeight) {
              setVideoAspectRatio(video.videoWidth / video.videoHeight);
            }
          }}
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex min-h-16 items-end justify-between gap-3 bg-gradient-to-t from-black/55 via-black/20 to-transparent p-3 text-white">
        <div className="min-w-0 rounded-lg border border-white/15 bg-black/35 px-3 py-2 shadow-sm backdrop-blur-md">
          <p className="truncate text-sm font-semibold">
            {displayName}
            {isLocal ? " (You)" : ""}
          </p>
          <p className="mt-0.5 text-xs text-white/75">
            {isHost ? "Host" : "Guest"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {screenSharing ? (
            <span className="grid size-7 place-items-center rounded-full border border-white/20 bg-primary/35 text-white shadow-sm backdrop-blur-md">
              <MonitorUp className="h-4 w-4" aria-label="Screen sharing" />
            </span>
          ) : null}
          {isOpeningMicrophone ? (
            <span className="grid size-7 place-items-center rounded-full border border-white/20 bg-white/15 text-white shadow-sm backdrop-blur-md">
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-label="Opening microphone"
              />
            </span>
          ) : audioEnabled && !hasMicrophoneError ? (
            <span
              className={cn(
                "relative grid size-7 place-items-center rounded-full border border-white/20 bg-white/15 text-white shadow-sm backdrop-blur-md transition",
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
            <span className="grid size-7 place-items-center rounded-full border border-white/20 bg-danger/35 text-white shadow-sm backdrop-blur-md">
              <MicOff
                className="h-4 w-4"
                aria-label={
                  hasMicrophoneError
                    ? "Microphone unavailable"
                    : "Microphone off"
                }
              />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
