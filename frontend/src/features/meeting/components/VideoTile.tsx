"use client";

import { useEffect, useMemo, useRef } from "react";
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
import { cn } from "@/lib/utils/cn";

interface VideoTileProps {
  audioEnabled?: boolean;
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
  audioStatus = audioEnabled ? "ready" : "off",
  className,
  displayName,
  isHost = false,
  isLocal = false,
  mode = "p2p",
  onMaximize,
  screenSharing = false,
  screenShareStatus = screenSharing ? "starting" : "off",
  stream,
  videoEnabled = true,
  videoStatus = videoEnabled ? "starting" : "off"
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasVideo = Boolean(
    stream?.getVideoTracks().length && (videoEnabled || screenSharing)
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
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <article
      className={cn(
        "relative grid aspect-video min-h-[180px] overflow-hidden rounded-lg border border-border bg-surface shadow-sm",
        className
      )}
    >
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

      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          className={cn(
            "h-full w-full object-cover",
            isLocal && "scale-x-[-1]"
          )}
          muted={isLocal}
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
          <VideoOff
            className="absolute right-4 top-4 h-5 w-5"
            aria-hidden="true"
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex min-h-14 items-end justify-between gap-3 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {displayName}
            {isLocal ? " (You)" : ""}
          </p>
          <p className="text-xs text-white/75">
            {isHost ? "Host" : "Guest"} · {mode.toUpperCase()}
          </p>
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
            <Mic className="h-4 w-4" aria-label="Microphone on" />
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
