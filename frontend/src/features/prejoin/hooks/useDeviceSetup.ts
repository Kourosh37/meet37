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

type PreviewOverrides = Partial<
  Pick<
    DeviceSetupState,
    | "audioEnabled"
    | "selectedAudioDeviceId"
    | "selectedVideoDeviceId"
    | "videoEnabled"
  >
>;

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

function removeTracksByKind(
  stream: MediaStream | null,
  kind: MediaStreamTrack["kind"]
) {
  if (!stream) {
    return null;
  }

  const retainedTracks = stream.getTracks().filter((track) => {
    if (track.kind !== kind) {
      return true;
    }

    track.stop();
    return false;
  });

  return retainedTracks.length ? new MediaStream(retainedTracks) : null;
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
    async (overrides?: PreviewOverrides) => {
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
      const selectedAudioDeviceId =
        overrides?.selectedAudioDeviceId ?? state.selectedAudioDeviceId;
      const selectedVideoDeviceId =
        overrides?.selectedVideoDeviceId ?? state.selectedVideoDeviceId;

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
                deviceId: selectedAudioDeviceId
                  ? { exact: selectedAudioDeviceId }
                  : undefined
              }
            : false,
          video: videoEnabled
            ? {
                deviceId: selectedVideoDeviceId
                  ? { exact: selectedVideoDeviceId }
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
      if (audioEnabled) {
        void startPreview({ audioEnabled: true });
        return;
      }

      setState((current) => ({
        ...current,
        audioEnabled,
        previewStream: removeTracksByKind(current.previewStream, "audio")
      }));
    },
    [mediaStore, startPreview]
  );

  const setVideoEnabled = useCallback(
    (videoEnabled: boolean) => {
      mediaStore.setVideoEnabled(videoEnabled);
      if (videoEnabled) {
        void startPreview({ videoEnabled: true });
        return;
      }

      setState((current) => ({
        ...current,
        previewStream: removeTracksByKind(current.previewStream, "video"),
        videoEnabled
      }));
    },
    [mediaStore, startPreview]
  );

  const setSelectedAudioDeviceId = useCallback(
    (selectedAudioDeviceId: string) => {
      mediaStore.setSelectedAudioDeviceId(selectedAudioDeviceId);
      setState((current) => ({ ...current, selectedAudioDeviceId }));
      if (state.audioEnabled && hasLiveTrack(state.previewStream, "audio")) {
        void startPreview({ selectedAudioDeviceId });
      }
    },
    [mediaStore, startPreview, state.audioEnabled, state.previewStream]
  );

  const setSelectedVideoDeviceId = useCallback(
    (selectedVideoDeviceId: string) => {
      mediaStore.setSelectedVideoDeviceId(selectedVideoDeviceId);
      setState((current) => ({ ...current, selectedVideoDeviceId }));
      if (state.videoEnabled && hasLiveTrack(state.previewStream, "video")) {
        void startPreview({ selectedVideoDeviceId });
      }
    },
    [mediaStore, startPreview, state.previewStream, state.videoEnabled]
  );

  useEffect(() => {
    void enumerateDevices();
  }, [enumerateDevices]);

  useEffect(() => {
    if (state.audioEnabled || state.videoEnabled) {
      void startPreview();
    }
    // This is an initial permission/preview request. Device changes and toggles
    // are handled by their own callbacks to avoid repeated prompts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
