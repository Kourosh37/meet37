"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalMediaPermissionState } from "@/features/meeting/types/media";
import { useMediaStore } from "@/features/meeting/stores/mediaStore";
import {
  applyAudioTrackConstraints,
  buildAudioConstraints
} from "@/lib/webrtc/audioQuality";
import {
  applyVideoTrackConstraints,
  buildCameraConstraints,
  setVideoContentHint
} from "@/lib/webrtc/videoQuality";

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
  const initialPreviewStartedRef = useRef(false);
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
            ? buildAudioConstraints(selectedAudioDeviceId)
            : false,
          video: videoEnabled ? buildCameraConstraints(selectedVideoDeviceId) : false
        });
        await Promise.all(
          stream
            .getAudioTracks()
            .map((track) => applyAudioTrackConstraints(track))
        );
        stream.getVideoTracks().forEach((track) => {
          setVideoContentHint(track, "motion");
        });
        await Promise.all(
          stream
            .getVideoTracks()
            .map((track) => applyVideoTrackConstraints(track))
        );

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
    if (initialPreviewStartedRef.current) {
      return;
    }
    initialPreviewStartedRef.current = true;
    if (state.audioEnabled || state.videoEnabled) {
      void startPreview();
    }
  }, [startPreview, state.audioEnabled, state.videoEnabled]);

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
