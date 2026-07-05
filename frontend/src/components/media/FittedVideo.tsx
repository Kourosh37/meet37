"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type FittedSize = {
  height: number | null;
  width: number | null;
};

interface FittedVideoProps {
  className?: string;
  deferUntilReady?: boolean;
  mirrored?: boolean;
  muted?: boolean;
  stream: MediaStream | null;
  videoClassName?: string;
}

function getTrackDimensions(stream: MediaStream | null) {
  const settings = stream?.getVideoTracks()[0]?.getSettings();
  const width = settings?.width ?? 0;
  const height = settings?.height ?? 0;

  return width > 0 && height > 0 ? { height, width } : null;
}

export function FittedVideo({
  className,
  deferUntilReady = false,
  mirrored = false,
  muted = true,
  stream,
  videoClassName
}: FittedVideoProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [fittedSize, setFittedSize] = useState<FittedSize>({
    height: null,
    width: null
  });
  const [hasInitialFit, setHasInitialFit] = useState(!deferUntilReady);
  const videoTrackKey = useMemo(
    () =>
      stream
        ?.getVideoTracks()
        .map((track) => {
          const settings = track.getSettings?.() ?? {};
          return [
            track.id,
            track.readyState,
            track.muted ? "muted" : "live",
            settings.width ?? 0,
            settings.height ?? 0
          ].join(":");
        })
        .join("|") ?? "",
    [stream]
  );

  const updateFit = useCallback(() => {
    const frame = frameRef.current;
    const video = videoRef.current;

    if (!frame || frame.clientWidth <= 0 || frame.clientHeight <= 0) {
      return;
    }

    const trackDimensions = getTrackDimensions(stream);
    const videoWidth = video?.videoWidth || trackDimensions?.width || 0;
    const videoHeight = video?.videoHeight || trackDimensions?.height || 0;

    if (videoWidth <= 0 || videoHeight <= 0) {
      setFittedSize({ height: null, width: null });
      return;
    }

    const heightIfWidthMatchesTile =
      frame.clientWidth * (videoHeight / videoWidth);

    if (heightIfWidthMatchesTile <= frame.clientHeight) {
      setFittedSize({
        height: heightIfWidthMatchesTile,
        width: frame.clientWidth
      });
      setHasInitialFit(true);
      return;
    }

    setFittedSize({
      height: frame.clientHeight,
      width: frame.clientHeight * (videoWidth / videoHeight)
    });
    setHasInitialFit(true);
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const nextStream = stream;
    setHasInitialFit(!deferUntilReady || !nextStream);
    if (video.srcObject !== nextStream) {
      video.srcObject = nextStream;
    }
    video.muted = muted;
    video.playsInline = true;

    if (nextStream && process.env.NODE_ENV !== "test") {
      const play = () => {
        try {
          const result = video.play();
          result
            ?.then?.(() => updateFit())
            .catch?.(() => updateFit());
        } catch {
          updateFit();
          return;
        }
      };
      play();
      window.setTimeout(play, 0);
    }

    updateFit();
    const animationFrame = window.requestAnimationFrame(updateFit);
    const timeout = window.setTimeout(updateFit, 100);
    const retryTimeouts = [250, 500, 1000, 2000, 3500].map((delay) =>
      window.setTimeout(updateFit, delay)
    );
    let frameAttempts = 0;
    let frameRequest = 0;
    let videoFrameRequest = 0;
    let videoFrameAttempts = 0;

    const watchUntilReady = () => {
      updateFit();
      frameAttempts += 1;

      if (frameAttempts < 90 && (!video.videoWidth || !video.videoHeight)) {
        frameRequest = window.requestAnimationFrame(watchUntilReady);
      }
    };

    frameRequest = window.requestAnimationFrame(watchUntilReady);

    if ("requestVideoFrameCallback" in video) {
      const requestVideoFrameCallback =
        video.requestVideoFrameCallback.bind(video);
      const onVideoFrame: VideoFrameRequestCallback = () => {
        updateFit();
        videoFrameAttempts += 1;
        if (videoFrameAttempts < 90) {
          videoFrameRequest = requestVideoFrameCallback(onVideoFrame);
        }
      };
      videoFrameRequest = requestVideoFrameCallback(onVideoFrame);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(frameRequest);
      if ("cancelVideoFrameCallback" in video && videoFrameRequest) {
        video.cancelVideoFrameCallback(videoFrameRequest);
      }
      window.clearTimeout(timeout);
      retryTimeouts.forEach((retryTimeout) => {
        window.clearTimeout(retryTimeout);
      });
      if (video.srcObject === nextStream) {
        video.srcObject = null;
      }
    };
  }, [deferUntilReady, muted, stream, updateFit, videoTrackKey]);

  useEffect(() => {
    const frame = frameRef.current;
    const video = videoRef.current;

    updateFit();
    video?.addEventListener("loadedmetadata", updateFit);
    video?.addEventListener("loadeddata", updateFit);
    video?.addEventListener("canplay", updateFit);
    video?.addEventListener("resize", updateFit);
    window.addEventListener("orientationchange", updateFit);
    document.addEventListener("visibilitychange", updateFit);
    stream?.getVideoTracks().forEach((track) => {
      track.addEventListener?.("mute", updateFit);
      track.addEventListener?.("unmute", updateFit);
      track.addEventListener?.("ended", updateFit);
    });

    if (typeof ResizeObserver === "undefined" || !frame) {
      window.addEventListener("resize", updateFit);
      return () => {
        window.removeEventListener("resize", updateFit);
        window.removeEventListener("orientationchange", updateFit);
        document.removeEventListener("visibilitychange", updateFit);
        video?.removeEventListener("loadedmetadata", updateFit);
        video?.removeEventListener("loadeddata", updateFit);
        video?.removeEventListener("canplay", updateFit);
        video?.removeEventListener("resize", updateFit);
        stream?.getVideoTracks().forEach((track) => {
          track.removeEventListener?.("mute", updateFit);
          track.removeEventListener?.("unmute", updateFit);
          track.removeEventListener?.("ended", updateFit);
        });
      };
    }

    const observer = new ResizeObserver(updateFit);
    observer.observe(frame);

    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", updateFit);
      document.removeEventListener("visibilitychange", updateFit);
      video?.removeEventListener("loadedmetadata", updateFit);
      video?.removeEventListener("loadeddata", updateFit);
      video?.removeEventListener("canplay", updateFit);
      video?.removeEventListener("resize", updateFit);
      stream?.getVideoTracks().forEach((track) => {
        track.removeEventListener?.("mute", updateFit);
        track.removeEventListener?.("unmute", updateFit);
        track.removeEventListener?.("ended", updateFit);
      });
    };
  }, [stream, updateFit, videoTrackKey]);

  return (
    <div
      ref={frameRef}
      className={cn(
        "grid h-full w-full place-items-center overflow-hidden bg-black",
        className
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        className={cn(
          "block max-h-full max-w-full bg-black object-contain",
          mirrored && "scale-x-[-1]",
          videoClassName
        )}
        muted={muted}
        onCanPlay={updateFit}
        onLoadedData={updateFit}
        onLoadedMetadata={updateFit}
        onResize={updateFit}
        playsInline
        style={
          fittedSize.width && fittedSize.height
            ? {
                height: `${fittedSize.height}px`,
                objectFit: "contain",
                opacity:
                  hasInitialFit || process.env.NODE_ENV === "test" ? 1 : 0,
                transition: deferUntilReady ? "opacity 120ms ease" : undefined,
                width: `${fittedSize.width}px`
              }
            : {
                height: "100%",
                objectFit: "contain",
                opacity:
                  hasInitialFit || process.env.NODE_ENV === "test" ? 1 : 0,
                transition: deferUntilReady ? "opacity 120ms ease" : undefined,
                width: "100%"
              }
        }
      />
    </div>
  );
}
