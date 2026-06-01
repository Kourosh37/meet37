"use client";

import { useEffect, useState } from "react";

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export function useAudioLevel(
  stream: MediaStream | null,
  enabled = true,
  smoothing = 0.7
) {
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    const liveAudioTracks =
      stream
        ?.getAudioTracks()
        .filter((track) => track.readyState === "live" && !track.muted) ?? [];

    if (!enabled || liveAudioTracks.length === 0) {
      setAudioLevel(0);
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ?? (window as AudioWindow).webkitAudioContext;

    if (!AudioContextConstructor) {
      setAudioLevel(0);
      return;
    }

    const audioStream = new MediaStream(liveAudioTracks);
    const context = new AudioContextConstructor();
    const analyser = context.createAnalyser();
    const source = context.createMediaStreamSource(audioStream);
    let animationFrame = 0;
    let closed = false;
    let smoothedLevel = 0;

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = smoothing;
    const samples = new Uint8Array(analyser.fftSize);
    source.connect(analyser);

    const measure = () => {
      if (closed) {
        return;
      }

      analyser.getByteTimeDomainData(samples);
      let sum = 0;

      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / samples.length);
      const rawLevel = Math.min(1, Math.max(0, (rms - 0.012) * 6.5));
      smoothedLevel = smoothedLevel * 0.62 + rawLevel * 0.38;
      setAudioLevel((current) =>
        Math.abs(current - smoothedLevel) > 0.012 ? smoothedLevel : current
      );
      animationFrame = window.requestAnimationFrame(measure);
    };

    void context.resume().catch(() => undefined);
    measure();

    return () => {
      closed = true;
      window.cancelAnimationFrame(animationFrame);
      source.disconnect();
      analyser.disconnect();
      void context.close().catch(() => undefined);
      setAudioLevel(0);
    };
  }, [enabled, smoothing, stream]);

  return audioLevel;
}
