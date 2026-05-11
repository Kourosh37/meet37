import { memo, useEffect, useRef } from 'react';
import type { Track } from 'livekit-client';

type MediaTrackFit = 'cover' | 'contain';

function MediaTrackBase({
  track,
  muted,
  fit = 'cover',
}: {
  track: Track;
  muted?: boolean;
  fit?: MediaTrackFit;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const element = track.attach();
    if (element instanceof HTMLMediaElement) {
      element.autoplay = true;
      element.muted = Boolean(muted);
      if (element instanceof HTMLVideoElement) {
        element.playsInline = true;
        element.className = `h-full w-full ${fit === 'contain' ? 'object-contain bg-black' : 'object-cover'}`;
      }
    }
    container.appendChild(element);

    return () => {
      track.detach(element);
      element.remove();
    };
  }, [fit, muted, track]);

  return <div ref={containerRef} className="h-full w-full" />;
}

export const MediaTrack = memo(MediaTrackBase);
