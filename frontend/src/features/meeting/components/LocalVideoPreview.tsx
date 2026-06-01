"use client";

import { useEffect, useRef } from "react";
import { VideoOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface LocalVideoPreviewProps {
  className?: string;
  muted?: boolean;
  stream: MediaStream | null;
  videoEnabled?: boolean;
}

export function LocalVideoPreview({
  className,
  muted = true,
  stream,
  videoEnabled = true
}: LocalVideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = videoEnabled ? stream : null;
    }
  }, [stream, videoEnabled]);

  const hasVideo = Boolean(stream?.getVideoTracks().length && videoEnabled);

  return (
    <div
      className={cn(
        "relative grid aspect-video min-h-0 place-items-center overflow-hidden rounded-lg border border-border bg-black",
        className
      )}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          className="h-full w-full scale-x-[-1] object-contain"
          muted={muted}
          playsInline
        />
      ) : (
        <div className="grid place-items-center gap-3 text-muted-foreground">
          <VideoOff className="h-8 w-8" aria-hidden="true" />
          <span className="text-sm font-medium">Camera off</span>
        </div>
      )}
    </div>
  );
}
