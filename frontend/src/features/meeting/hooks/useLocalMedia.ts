/*
Frontend architecture note

File: src\features\meeting\hooks\useLocalMedia.ts
Layer: Meeting Runtime

Responsibility:
- Frontend file for the Meeting Runtime layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: WebSocket signaling endpoint described in backend/docs/WEBSOCKET.md plus room metadata from GET /api/rooms/{id}. The join payload must include display_name and may include password and host_token.

State model to plan: idle, prejoining, waiting-approval, joining, in-call, reconnecting, sfu-active, kicked, rejected, room-closed, media-error, and left.

UX and edge cases to plan:
- Display clear loading and empty states instead of rendering nothing once implementation starts.
- Normalize backend errors into user-safe messages while preserving technical details for logger.ts.
- Keep room links shareable; never require global login just to open an existing meeting link.
- In private app mode, require login only for room creation, not for joining a shared room link.
- Every meeting participant must provide a non-empty display name before joining.

Security and privacy notes:
- Never expose refresh tokens to arbitrary components; use the storage/auth layer only.
- Treat host_token as room-scoped moderation authority and avoid leaking it into URLs or logs.
- Do not persist raw media streams, SDP blobs, ICE candidates, or file bytes unless a later backend feature explicitly requires it.

Future tests: WebSocket join flow, approval room flow, host approve/reject, kick/mute messages, P2P signaling, SFU switch handling, chat/file events, and cleanup on leave.

*/

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaStore } from "@/features/meeting/stores/mediaStore";
import { stopMediaStream } from "@/lib/webrtc/PeerConnectionFactory";

export function useLocalMedia() {
  const audioEnabled = useMediaStore((state) => state.audioEnabled);
  const videoEnabled = useMediaStore((state) => state.videoEnabled);
  const screenSharing = useMediaStore((state) => state.screenSharing);
  const selectedAudioDeviceId = useMediaStore(
    (state) => state.selectedAudioDeviceId
  );
  const selectedVideoDeviceId = useMediaStore(
    (state) => state.selectedVideoDeviceId
  );
  const error = useMediaStore((state) => state.error);
  const setAudioEnabled = useMediaStore((state) => state.setAudioEnabled);
  const setVideoEnabled = useMediaStore((state) => state.setVideoEnabled);
  const setScreenSharing = useMediaStore((state) => state.setScreenSharing);
  const setError = useMediaStore((state) => state.setError);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  const start = useCallback(async (overrides?: {
    audioEnabled?: boolean;
    videoEnabled?: boolean;
  }) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Media devices are not available in this browser.");
      return null;
    }

    const mediaState = useMediaStore.getState();
    const shouldUseAudio = overrides?.audioEnabled ?? mediaState.audioEnabled;
    const shouldUseVideo = overrides?.videoEnabled ?? mediaState.videoEnabled;
    const audioDeviceId = mediaState.selectedAudioDeviceId;
    const videoDeviceId = mediaState.selectedVideoDeviceId;

    if (!shouldUseAudio && !shouldUseVideo) {
      setStream((current) => {
        stopMediaStream(current);
        return null;
      });
      setError(null);
      return null;
    }

    try {
      setIsStarting(true);
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: shouldUseAudio
          ? {
              deviceId: audioDeviceId
                ? { exact: audioDeviceId }
                : undefined
            }
          : false,
        video: shouldUseVideo
          ? {
              deviceId: videoDeviceId
                ? { exact: videoDeviceId }
                : undefined
            }
          : false
      });

      setStream((current) => {
        stopMediaStream(current);
        return nextStream;
      });
      nextStream.getAudioTracks().forEach((track) => {
        track.enabled = shouldUseAudio;
      });
      nextStream.getVideoTracks().forEach((track) => {
        track.enabled = shouldUseVideo;
      });

      setError(null);
      return nextStream;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not start local media."
      );
      return null;
    } finally {
      setIsStarting(false);
    }
  }, [setError]);

  const stop = useCallback(() => {
    screenTrackRef.current = null;
    setScreenSharing(false);
    setStream((current) => {
      stopMediaStream(current);
      return null;
    });
  }, [setScreenSharing]);

  const stopScreenShare = useCallback(() => {
    const screenTrack = screenTrackRef.current;
    screenTrackRef.current = null;
    if (screenTrack) {
      screenTrack.onended = null;
      screenTrack.stop();
    }
    setScreenSharing(false);

    if (videoEnabled) {
      void start({ videoEnabled: true });
      return;
    }

    setStream((current) => {
      if (!current) {
        return null;
      }

      current.getVideoTracks().forEach((track) => {
        current.removeTrack(track);
        track.stop();
      });
      return new MediaStream(current.getTracks());
    });
  }, [setScreenSharing, start, videoEnabled]);

  const startScreenShare = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Screen sharing is not available in this browser.");
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: true
      });
      const screenTrack = displayStream.getVideoTracks()[0];

      if (!screenTrack) {
        stopMediaStream(displayStream);
        setError("Could not start screen sharing.");
        return;
      }

      screenTrackRef.current?.stop();
      screenTrackRef.current = screenTrack;
      screenTrack.onended = () => stopScreenShare();
      setScreenSharing(true);
      setError(null);

      setStream((current) => {
        const audioTracks = current?.getAudioTracks() ?? [];
        current?.getVideoTracks().forEach((track) => {
          current.removeTrack(track);
          if (track !== screenTrack) {
            track.stop();
          }
        });
        return new MediaStream([...audioTracks, screenTrack]);
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not start screen sharing."
      );
    }
  }, [setError, setScreenSharing, stopScreenShare]);

  const toggleScreenShare = useCallback(() => {
    if (screenSharing) {
      stopScreenShare();
      return;
    }

    void startScreenShare();
  }, [screenSharing, startScreenShare, stopScreenShare]);

  const toggleAudio = useCallback(() => {
    const enabled = !audioEnabled;
    setAudioEnabled(enabled);
    if (enabled && !stream?.getAudioTracks().length) {
      void start({ audioEnabled: true });
      return;
    }
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }, [audioEnabled, setAudioEnabled, start, stream]);

  const toggleVideo = useCallback(() => {
    if (screenSharing) {
      stopScreenShare();
      return;
    }

    const enabled = !videoEnabled;
    setVideoEnabled(enabled);
    if (enabled && !stream?.getVideoTracks().length) {
      void start({ videoEnabled: true });
      return;
    }
    stream?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }, [screenSharing, setVideoEnabled, start, stopScreenShare, stream, videoEnabled]);

  useEffect(() => () => stopMediaStream(stream), [stream]);

  return {
    audioEnabled,
    error,
    isStarting,
    screenSharing,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    setScreenSharing,
    start,
    stop,
    stream,
    toggleAudio,
    toggleScreenShare,
    toggleVideo,
    videoEnabled
  };
}
