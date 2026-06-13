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
  const previewOperationRef = useRef(Promise.resolve());
  const [state, setState] = useState<DeviceSetupState>(() => ({
    ...initialState,
    audioEnabled: mediaStore.audioEnabled,
    selectedAudioDeviceId: mediaStore.selectedAudioDeviceId,
    selectedVideoDeviceId: mediaStore.selectedVideoDeviceId,
    videoEnabled: mediaStore.videoEnabled
  }));
  const stateRef = useRef(state);

  const runPreviewOperation = useCallback(<T>(operation: () => Promise<T>) => {
    const nextOperation = previewOperationRef.current.then(operation, operation);
    previewOperationRef.current = nextOperation.then(
      () => undefined,
      () => undefined
    );
    return nextOperation;
  }, []);

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
          error: "error.mediaDevicesUnavailable",
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
      } catch {
        setState((current) => ({
          ...current,
          error: "error.couldNotStartCameraOrMicrophone",
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

  const startAudioPreviewImmediately = useCallback(
    async (selectedAudioDeviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState((current) => ({
          ...current,
          error: "error.mediaDevicesUnavailable",
          permissionState: "error"
        }));
        return;
      }

      const audioDeviceId =
        selectedAudioDeviceId ?? stateRef.current.selectedAudioDeviceId;

      setState((current) => ({
        ...current,
        audioEnabled: true,
        error: null,
        permissionState: "prompting"
      }));

      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: buildAudioConstraints(audioDeviceId),
          video: false
        });
        const audioTracks = audioStream.getAudioTracks();

        if (!audioTracks.length) {
          stopStream(audioStream);
          setState((current) => ({
            ...current,
            error: "error.couldNotStartCameraOrMicrophone",
            permissionState: "denied"
          }));
          return;
        }

        await Promise.all(
          audioTracks.map((track) => applyAudioTrackConstraints(track))
        );
        audioTracks.forEach((track) => {
          track.enabled = true;
        });

        if (!useMediaStore.getState().audioEnabled) {
          stopStream(audioStream);
          return;
        }

        setState((current) => {
          current.previewStream?.getAudioTracks().forEach((track) => {
            track.stop();
          });

          return {
            ...current,
            audioEnabled: true,
            error: null,
            permissionState: "granted",
            previewStream: new MediaStream([
              ...(current.previewStream?.getVideoTracks() ?? []),
              ...audioTracks
            ])
          };
        });
        await enumerateDevices();
      } catch {
        setState((current) => ({
          ...current,
          error: "error.couldNotStartCameraOrMicrophone",
          permissionState: "denied"
        }));
      }
    },
    [enumerateDevices]
  );

  const startVideoPreviewImmediately = useCallback(
    async (selectedVideoDeviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState((current) => ({
          ...current,
          error: "error.mediaDevicesUnavailable",
          permissionState: "error"
        }));
        return;
      }

      const videoDeviceId =
        selectedVideoDeviceId ?? stateRef.current.selectedVideoDeviceId;

      setState((current) => ({
        ...current,
        error: null,
        permissionState: "prompting",
        videoEnabled: true
      }));

      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: buildCameraConstraints(videoDeviceId)
        });
        const videoTracks = videoStream.getVideoTracks();

        if (!videoTracks.length) {
          stopStream(videoStream);
          setState((current) => ({
            ...current,
            error: "error.couldNotStartCameraOrMicrophone",
            permissionState: "denied"
          }));
          return;
        }

        videoTracks.forEach((track) => {
          setVideoContentHint(track, "motion");
          track.enabled = true;
        });
        await Promise.all(
          videoTracks.map((track) => applyVideoTrackConstraints(track))
        );

        if (!useMediaStore.getState().videoEnabled) {
          stopStream(videoStream);
          return;
        }

        setState((current) => {
          current.previewStream?.getVideoTracks().forEach((track) => {
            track.stop();
          });

          return {
            ...current,
            error: null,
            permissionState: "granted",
            previewStream: new MediaStream([
              ...(current.previewStream?.getAudioTracks() ?? []),
              ...videoTracks
            ]),
            videoEnabled: true
          };
        });
        await enumerateDevices();
      } catch {
        setState((current) => ({
          ...current,
          error: "error.couldNotStartCameraOrMicrophone",
          permissionState: "denied"
        }));
      }
    },
    [enumerateDevices]
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
        void runPreviewOperation(startAudioPreviewImmediately);
        return;
      }

      setState((current) => ({
        ...current,
        audioEnabled,
        previewStream: removeTracksByKind(current.previewStream, "audio")
      }));
    },
    [mediaStore, runPreviewOperation, startAudioPreviewImmediately]
  );

  const setVideoEnabled = useCallback(
    (videoEnabled: boolean) => {
      mediaStore.setVideoEnabled(videoEnabled);
      if (videoEnabled) {
        void runPreviewOperation(startVideoPreviewImmediately);
        return;
      }

      setState((current) => ({
        ...current,
        previewStream: removeTracksByKind(current.previewStream, "video"),
        videoEnabled
      }));
    },
    [mediaStore, runPreviewOperation, startVideoPreviewImmediately]
  );

  const setSelectedAudioDeviceId = useCallback(
    (selectedAudioDeviceId: string) => {
      mediaStore.setSelectedAudioDeviceId(selectedAudioDeviceId);
      setState((current) => ({ ...current, selectedAudioDeviceId }));
      if (state.audioEnabled && hasLiveTrack(state.previewStream, "audio")) {
        void runPreviewOperation(() =>
          startAudioPreviewImmediately(selectedAudioDeviceId)
        );
      }
    },
    [
      mediaStore,
      runPreviewOperation,
      startAudioPreviewImmediately,
      state.audioEnabled,
      state.previewStream
    ]
  );

  const setSelectedVideoDeviceId = useCallback(
    (selectedVideoDeviceId: string) => {
      mediaStore.setSelectedVideoDeviceId(selectedVideoDeviceId);
      setState((current) => ({ ...current, selectedVideoDeviceId }));
      if (state.videoEnabled && hasLiveTrack(state.previewStream, "video")) {
        void runPreviewOperation(() =>
          startVideoPreviewImmediately(selectedVideoDeviceId)
        );
      }
    },
    [
      mediaStore,
      runPreviewOperation,
      startVideoPreviewImmediately,
      state.previewStream,
      state.videoEnabled
    ]
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    void enumerateDevices();
  }, [enumerateDevices]);

  useEffect(() => {
    if (initialPreviewStartedRef.current) {
      return;
    }
    initialPreviewStartedRef.current = true;
    if (state.audioEnabled || state.videoEnabled) {
      void runPreviewOperation(startPreview);
    }
  }, [runPreviewOperation, startPreview, state.audioEnabled, state.videoEnabled]);

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
