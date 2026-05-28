"use client";

import { useEffect, useMemo, useRef } from "react";
import { Mic, MicOff, MonitorUp, VideoOff } from "lucide-react";
import type { PeerMode } from "@/features/meeting/types/signaling";
import { cn } from "@/lib/utils/cn";

interface VideoTileProps {
  audioEnabled?: boolean;
  className?: string;
  displayName: string;
  isHost?: boolean;
  isLocal?: boolean;
  mode?: PeerMode;
  screenSharing?: boolean;
  stream: MediaStream | null;
  videoEnabled?: boolean;
}

export function VideoTile({
  audioEnabled = true,
  className,
  displayName,
  isHost = false,
  isLocal = false,
  mode = "p2p",
  screenSharing = false,
  stream,
  videoEnabled = true
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasVideo = Boolean(stream?.getVideoTracks().length && videoEnabled);
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
          {audioEnabled ? (
            <Mic className="h-4 w-4" aria-label="Microphone on" />
          ) : (
            <MicOff
              className="h-4 w-4 text-danger"
              aria-label="Microphone off"
            />
          )}
        </div>
      </div>
    </article>
  );
}
