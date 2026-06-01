"use client";

import { useEffect, useRef } from "react";

interface RemoteAudioPlayerProps {
  streams: Record<string, MediaStream>;
}

function RemoteAudioElement({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTrackKey = stream
    .getAudioTracks()
    .map((track) => `${track.id}:${track.readyState}:${track.enabled}`)
    .join("|");
  const hasAudio = audioTrackKey.length > 0;

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !hasAudio) {
      return;
    }

    const audioTracks = stream.getAudioTracks();
    const audioOnlyStream = new MediaStream(audioTracks);
    let retryTimer = 0;

    const play = () => {
      audio.muted = false;
      audio.volume = 1;
      void audio.play().catch(() => undefined);
    };

    const retryPlayback = () => {
      if (audio.paused || audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        play();
      }
    };

    audio.srcObject = audioOnlyStream;
    play();
    retryTimer = window.setInterval(retryPlayback, 900);

    window.addEventListener("click", play);
    window.addEventListener("keydown", play);
    window.addEventListener("pointerdown", play);
    window.addEventListener("touchend", play);
    audio.addEventListener("canplay", play);
    audio.addEventListener("loadedmetadata", play);
    audio.addEventListener("pause", play);
    audioTracks.forEach((track) => {
      track.addEventListener("unmute", play);
      track.addEventListener("mute", retryPlayback);
      track.addEventListener("ended", retryPlayback);
    });

    return () => {
      window.clearInterval(retryTimer);
      window.removeEventListener("click", play);
      window.removeEventListener("keydown", play);
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("touchend", play);
      audio.removeEventListener("canplay", play);
      audio.removeEventListener("loadedmetadata", play);
      audio.removeEventListener("pause", play);
      audioTracks.forEach((track) => {
        track.removeEventListener("unmute", play);
        track.removeEventListener("mute", retryPlayback);
        track.removeEventListener("ended", retryPlayback);
      });
      audio.pause();
      audio.srcObject = null;
    };
  }, [audioTrackKey, hasAudio, stream]);

  if (!hasAudio) {
    return null;
  }

  return <audio ref={audioRef} autoPlay playsInline />;
}

export function RemoteAudioPlayer({ streams }: RemoteAudioPlayerProps) {
  return (
    <div aria-hidden="true" className="sr-only">
      {Object.entries(streams).map(([peerId, stream]) => (
        <RemoteAudioElement key={peerId} stream={stream} />
      ))}
    </div>
  );
}
