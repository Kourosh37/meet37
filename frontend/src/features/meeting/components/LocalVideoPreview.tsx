"use client";

import { FittedVideo } from "@/components/media/FittedVideo";
import { VideoOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLocale } from "@/providers/LocaleProvider";

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
  const { t } = useLocale();
  const hasVideo = Boolean(stream?.getVideoTracks().length && videoEnabled);

  return (
    <div
      className={cn(
        "relative grid aspect-video min-h-0 place-items-center overflow-hidden rounded-lg border border-border bg-black",
        className
      )}
    >
      {hasVideo ? (
        <FittedVideo mirrored muted={muted} stream={stream} />
      ) : (
        <div className="grid place-items-center gap-3 text-muted-foreground">
          <VideoOff className="h-8 w-8" aria-hidden="true" />
          <span className="text-sm font-medium">{t("meeting.cameraOff")}</span>
        </div>
      )}
    </div>
  );
}
