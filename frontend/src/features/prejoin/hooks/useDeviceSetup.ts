/*
Frontend architecture note

File: src\features\prejoin\hooks\useDeviceSetup.ts
Layer: Pre-Join

Responsibility:
- Frontend file for the Pre-Join layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: room metadata comes from GET /api/rooms/{id}; actual admission happens through WebSocket join, with password and approval handling based on room policy.

State model to plan: loading, ready, empty, recoverable error, fatal error, and cleanup/unmount behavior where applicable.

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

Future tests: success path, loading path, error path, accessibility expectations, and cleanup/side-effect boundaries.

*/

"use client";

import { useCallback, useEffect, useState } from "react";
import type { LocalMediaPermissionState } from "@/features/meeting/types/media";
import { useMediaStore } from "@/features/meeting/stores/mediaStore";

export interface DeviceSetupState {
  audioEnabled: boolean;
  audioInputs: MediaDeviceInfo[];
  error: string | null;
  permissionState: LocalMediaPermissionState;
  previewStream: MediaStream | null;
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
  videoEnabled: boolean;
  videoInputs: MediaDeviceInfo[];
}

const initialState: DeviceSetupState = {
  audioEnabled: true,
  audioInputs: [],
  error: null,
  permissionState: "idle",
  previewStream: null,
  selectedAudioDeviceId: "",
  selectedVideoDeviceId: "",
  videoEnabled: true,
  videoInputs: []
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function hasLiveTrack(
  stream: MediaStream | null,
  kind: MediaStreamTrack["kind"]
) {
  return Boolean(
    stream
      ?.getTracks()
      .some((track) => track.kind === kind && track.readyState === "live")
  );
}

export function useDeviceSetup() {
  const mediaStore = useMediaStore();
  const [state, setState] = useState<DeviceSetupState>(() => ({
    ...initialState,
    audioEnabled: mediaStore.audioEnabled,
    selectedAudioDeviceId: mediaStore.selectedAudioDeviceId,
    selectedVideoDeviceId: mediaStore.selectedVideoDeviceId,
    videoEnabled: mediaStore.videoEnabled
  }));

  const enumerateDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(
      (device) => device.kind === "audioinput"
    );
    const videoInputs = devices.filter(
      (device) => device.kind === "videoinput"
    );

    setState((current) => ({
      ...current,
      audioInputs,
      selectedAudioDeviceId:
        current.selectedAudioDeviceId || audioInputs[0]?.deviceId || "",
      selectedVideoDeviceId:
        current.selectedVideoDeviceId || videoInputs[0]?.deviceId || "",
      videoInputs
    }));
  }, []);

  const startPreview = useCallback(
    async (
      overrides?: Partial<
        Pick<DeviceSetupState, "audioEnabled" | "videoEnabled">
      >
    ) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState((current) => ({
          ...current,
          error: "Media devices are not available in this browser.",
          permissionState: "error"
        }));
        return;
      }

      const audioEnabled = overrides?.audioEnabled ?? state.audioEnabled;
      const videoEnabled = overrides?.videoEnabled ?? state.videoEnabled;

      if (!audioEnabled && !videoEnabled) {
        setState((current) => {
          stopStream(current.previewStream);
          return {
            ...current,
            audioEnabled,
            error: null,
            permissionState: "idle",
            previewStream: null,
            videoEnabled
          };
        });
        return;
      }

      setState((current) => ({
        ...current,
        error: null,
        permissionState: "prompting"
      }));

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioEnabled
            ? {
                deviceId: state.selectedAudioDeviceId
                  ? { exact: state.selectedAudioDeviceId }
                  : undefined
              }
            : false,
          video: videoEnabled
            ? {
                deviceId: state.selectedVideoDeviceId
                  ? { exact: state.selectedVideoDeviceId }
                  : undefined
              }
            : false
        });

        setState((current) => {
          stopStream(current.previewStream);
          return {
            ...current,
            audioEnabled,
            error: null,
            permissionState: "granted",
            previewStream: stream,
            videoEnabled
          };
        });
        await enumerateDevices();
      } catch (error) {
        setState((current) => ({
          ...current,
          error:
            error instanceof Error
              ? error.message
              : "Could not start camera or microphone.",
          permissionState: "denied"
        }));
      }
    },
    [
      enumerateDevices,
      state.audioEnabled,
      state.selectedAudioDeviceId,
      state.selectedVideoDeviceId,
      state.videoEnabled
    ]
  );

  const stopPreview = useCallback(() => {
    setState((current) => {
      stopStream(current.previewStream);
      return { ...current, previewStream: null, permissionState: "idle" };
    });
  }, []);

  const setAudioEnabled = useCallback(
    (audioEnabled: boolean) => {
      mediaStore.setAudioEnabled(audioEnabled);
      setState((current) => {
        current.previewStream?.getAudioTracks().forEach((track) => {
          track.enabled = audioEnabled;
        });
        return { ...current, audioEnabled };
      });
    },
    [mediaStore]
  );

  const setVideoEnabled = useCallback(
    (videoEnabled: boolean) => {
      mediaStore.setVideoEnabled(videoEnabled);
      const shouldRestartPreview =
        videoEnabled && !hasLiveTrack(state.previewStream, "video");

      setState((current) => {
        current.previewStream?.getVideoTracks().forEach((track) => {
          track.enabled = videoEnabled;
        });
        return { ...current, videoEnabled };
      });

      if (shouldRestartPreview) {
        window.setTimeout(() => {
          void startPreview({ videoEnabled: true });
        }, 0);
      }
    },
    [mediaStore, startPreview, state.previewStream]
  );

  const setSelectedAudioDeviceId = useCallback(
    (selectedAudioDeviceId: string) => {
      mediaStore.setSelectedAudioDeviceId(selectedAudioDeviceId);
      setState((current) => ({ ...current, selectedAudioDeviceId }));
    },
    [mediaStore]
  );

  const setSelectedVideoDeviceId = useCallback(
    (selectedVideoDeviceId: string) => {
      mediaStore.setSelectedVideoDeviceId(selectedVideoDeviceId);
      setState((current) => ({ ...current, selectedVideoDeviceId }));
    },
    [mediaStore]
  );

  useEffect(() => {
    void enumerateDevices();
  }, [enumerateDevices]);

  useEffect(() => () => stopStream(state.previewStream), [state.previewStream]);

  return {
    ...state,
    setAudioEnabled,
    setSelectedAudioDeviceId,
    setSelectedVideoDeviceId,
    setVideoEnabled,
    startPreview,
    stopPreview
  };
}
