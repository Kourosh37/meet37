"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaStore } from "@/features/meeting/stores/mediaStore";
import type { MediaTrackStatus } from "@/features/meeting/types/signaling";
import {
  applyAudioTrackConstraints,
  buildAudioConstraints
} from "@/lib/webrtc/audioQuality";
import { stopMediaStream } from "@/lib/webrtc/PeerConnectionFactory";
import {
  applyVideoTrackConstraints,
  buildCameraConstraints,
  buildScreenShareConstraints,
  setVideoContentHint
} from "@/lib/webrtc/videoQuality";
import type { MessageKey } from "@/lib/i18n/messages";
import { useLocale } from "@/providers/LocaleProvider";

function isLocalhost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isIOSBrowser() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function getScreenShareUnavailableReason(t: (key: MessageKey) => string) {
  if (!window.isSecureContext && !isLocalhost(window.location.hostname)) {
    return t("error.screenShareRequiresHttps");
  }

  if (!navigator.mediaDevices?.getDisplayMedia && isIOSBrowser()) {
    return t("error.screenShareUnsupportedIos");
  }

  if (!navigator.mediaDevices?.getDisplayMedia && isMobileBrowser()) {
    return t("error.screenShareUnsupportedMobile");
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    return t("error.screenShareUnsupportedDevice");
  }

  return "";
}

function streamWithoutKind(
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

async function getDisplayMediaWithFallback() {
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: buildScreenShareConstraints()
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      ![
        "OverconstrainedError",
        "TypeError",
        "ConstraintNotSatisfiedError"
      ].includes(error.name)
    ) {
      throw error;
    }

    return navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: true
    });
  }
}

async function getUserMediaWithFallback(
  constraints: MediaStreamConstraints,
  fallback: MediaStreamConstraints
) {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    if (
      error instanceof DOMException &&
      ["NotAllowedError", "SecurityError", "AbortError"].includes(error.name)
    ) {
      throw error;
    }

    return navigator.mediaDevices.getUserMedia(fallback);
  }
}

async function getAudioMediaWithFallback(deviceId?: string) {
  return getUserMediaWithFallback(
    {
      audio: buildAudioConstraints(deviceId),
      video: false
    },
    {
      audio: true,
      video: false
    }
  );
}

async function getVideoMediaWithFallback(deviceId?: string) {
  return getUserMediaWithFallback(
    {
      audio: false,
      video: buildCameraConstraints(deviceId)
    },
    {
      audio: false,
      video: true
    }
  );
}

async function getLocalMediaWithFallback(options: {
  audioDeviceId?: string;
  shouldUseAudio: boolean;
  shouldUseVideo: boolean;
  videoDeviceId?: string;
}) {
  const { audioDeviceId, shouldUseAudio, shouldUseVideo, videoDeviceId } =
    options;

  if (shouldUseAudio && shouldUseVideo) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(audioDeviceId),
        video: buildCameraConstraints(videoDeviceId)
      });
    } catch {
      const streams = await Promise.allSettled([
        getAudioMediaWithFallback(audioDeviceId),
        getVideoMediaWithFallback(videoDeviceId)
      ]);
      const tracks = streams.flatMap((result) =>
        result.status === "fulfilled" ? result.value.getTracks() : []
      );

      if (tracks.length) {
        return new MediaStream(tracks);
      }

      const firstFailure = streams.find(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );
      throw firstFailure?.reason ?? new Error("Could not start local media");
    }
  }

  if (shouldUseAudio) {
    return getAudioMediaWithFallback(audioDeviceId);
  }

  return getVideoMediaWithFallback(videoDeviceId);
}

export function useLocalMedia() {
  const { t } = useLocale();
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
  const [audioStatus, setAudioStatus] = useState<MediaTrackStatus>(
    audioEnabled ? "starting" : "off"
  );
  const [videoStatus, setVideoStatus] = useState<MediaTrackStatus>(
    videoEnabled ? "starting" : "off"
  );
  const [screenShareStatus, setScreenShareStatus] =
    useState<MediaTrackStatus>("off");
  const [screenShareSupported, setScreenShareSupported] = useState(false);
  const [screenShareUnavailableReason, setScreenShareUnavailableReason] =
    useState(t("error.screenShareNotAvailable"));
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const currentStreamRef = useRef<MediaStream | null>(null);
  const mediaOperationRef = useRef(Promise.resolve());
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  const runMediaOperation = useCallback(<T>(operation: () => Promise<T>) => {
    const nextOperation = mediaOperationRef.current.then(operation, operation);
    mediaOperationRef.current = nextOperation.then(
      () => undefined,
      () => undefined
    );
    return nextOperation;
  }, []);

  const updateScreenShareSupport = useCallback(() => {
    const hasDisplayMedia = Boolean(navigator.mediaDevices?.getDisplayMedia);
    const isSecure = window.isSecureContext;
    const isLocal = isLocalhost(window.location.hostname);

    setScreenShareSupported(hasDisplayMedia && (isSecure || isLocal));
    setScreenShareUnavailableReason(getScreenShareUnavailableReason(t));
  }, [t]);

  const enumerateDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    setAudioInputs(devices.filter((device) => device.kind === "audioinput"));
    setVideoInputs(devices.filter((device) => device.kind === "videoinput"));
  }, []);

  const startImmediately = useCallback(
    async (overrides?: { audioEnabled?: boolean; videoEnabled?: boolean }) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("error.mediaDevicesUnavailable");
        return null;
      }

      const mediaState = useMediaStore.getState();
      const shouldUseAudio = overrides?.audioEnabled ?? mediaState.audioEnabled;
      const shouldUseVideo = overrides?.videoEnabled ?? mediaState.videoEnabled;
      const audioDeviceId = mediaState.selectedAudioDeviceId;
      const videoDeviceId = mediaState.selectedVideoDeviceId;

      if (!shouldUseAudio && !shouldUseVideo) {
        setAudioStatus("off");
        setVideoStatus("off");
        setStream((current) => {
          stopMediaStream(current);
          return null;
        });
        setError(null);
        return null;
      }

      try {
        setIsStarting(true);
        setAudioStatus(shouldUseAudio ? "starting" : "off");
        setVideoStatus(shouldUseVideo ? "starting" : "off");
        const nextStream = await getLocalMediaWithFallback({
          audioDeviceId,
          shouldUseAudio,
          shouldUseVideo,
          videoDeviceId
        });
        const hasAudioTrack = nextStream.getAudioTracks().length > 0;
        const hasVideoTrack = nextStream.getVideoTracks().length > 0;

        setStream((current) => {
          stopMediaStream(current);
          return nextStream;
        });
        await Promise.all(
          nextStream
            .getAudioTracks()
            .map((track) => applyAudioTrackConstraints(track))
        );
        nextStream.getAudioTracks().forEach((track) => {
          track.enabled = shouldUseAudio;
        });
        nextStream.getVideoTracks().forEach((track) => {
          setVideoContentHint(track, "motion");
          track.enabled = shouldUseVideo;
        });
        await Promise.all(
          nextStream
            .getVideoTracks()
            .map((track) => applyVideoTrackConstraints(track))
        );
        setAudioStatus(
          shouldUseAudio ? (hasAudioTrack ? "ready" : "error") : "off"
        );
        setVideoStatus(
          shouldUseVideo ? (hasVideoTrack ? "ready" : "error") : "off"
        );

        setError(
          (shouldUseAudio && !hasAudioTrack) || (shouldUseVideo && !hasVideoTrack)
            ? "error.couldNotStartLocalMedia"
            : null
        );
        await enumerateDevices();
        return nextStream;
      } catch {
        setAudioStatus(shouldUseAudio ? "error" : "off");
        setVideoStatus(shouldUseVideo ? "error" : "off");
        setError("error.couldNotStartLocalMedia");
        return null;
      } finally {
        setIsStarting(false);
      }
    },
    [enumerateDevices, setError]
  );

  const start = useCallback(
    (overrides?: { audioEnabled?: boolean; videoEnabled?: boolean }) =>
      runMediaOperation(() => startImmediately(overrides)),
    [runMediaOperation, startImmediately]
  );

  const startAudioTrackImmediately = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setAudioStatus("error");
      setError("error.mediaDevicesUnavailable");
      return;
    }

    try {
      setAudioStatus("starting");
      const audioDeviceId = useMediaStore.getState().selectedAudioDeviceId;
      const audioStream = await getAudioMediaWithFallback(audioDeviceId);
      const audioTracks = audioStream.getAudioTracks();

      if (!audioTracks.length) {
        stopMediaStream(audioStream);
        setAudioStatus("error");
        setError("error.couldNotStartMicrophone");
        return;
      }

      await Promise.all(
        audioTracks.map((track) => applyAudioTrackConstraints(track))
      );
      audioTracks.forEach((track) => {
        track.enabled = true;
      });
      setStream((current) => {
        current?.getAudioTracks().forEach((track) => {
          track.stop();
        });
        return new MediaStream([
          ...(current?.getVideoTracks() ?? []),
          ...audioTracks
        ]);
      });
      setAudioStatus("ready");
      setError(null);
      await enumerateDevices();
    } catch {
      setAudioStatus("error");
      setError("error.couldNotStartMicrophone");
    }
  }, [enumerateDevices, setError]);

  const startVideoTrackImmediately = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setVideoStatus("error");
      setError("error.mediaDevicesUnavailable");
      return;
    }

    try {
      setVideoStatus("starting");
      const videoDeviceId = useMediaStore.getState().selectedVideoDeviceId;
      const videoStream = await getVideoMediaWithFallback(videoDeviceId);
      const videoTracks = videoStream.getVideoTracks();

      if (!videoTracks.length) {
        stopMediaStream(videoStream);
        setVideoStatus("error");
        setError("error.couldNotStartLocalMedia");
        return;
      }

      videoTracks.forEach((track) => {
        setVideoContentHint(track, "motion");
        track.enabled = true;
      });
      await Promise.all(
        videoTracks.map((track) => applyVideoTrackConstraints(track))
      );

      if (
        !useMediaStore.getState().videoEnabled ||
        useMediaStore.getState().screenSharing
      ) {
        stopMediaStream(videoStream);
        setVideoStatus("off");
        return;
      }

      setStream((current) => {
        current?.getVideoTracks().forEach((track) => {
          track.stop();
        });
        return new MediaStream([
          ...(current?.getAudioTracks() ?? []),
          ...videoTracks
        ]);
      });
      setVideoStatus("ready");
      setError(null);
      await enumerateDevices();
    } catch {
      setVideoStatus("error");
      setError("error.couldNotStartLocalMedia");
    }
  }, [enumerateDevices, setError]);

  const stop = useCallback(() => {
    screenTrackRef.current = null;
    setAudioStatus("off");
    setVideoStatus("off");
    setScreenShareStatus("off");
    setScreenSharing(false);
    setStream((current) => {
      stopMediaStream(current);
      return null;
    });
  }, [setScreenSharing]);

  const stopScreenShareImmediately = useCallback(async () => {
    const screenTrack = screenTrackRef.current;
    screenTrackRef.current = null;
    if (screenTrack) {
      screenTrack.onended = null;
      screenTrack.stop();
    }
    setScreenSharing(false);
    setScreenShareStatus("off");

    if (useMediaStore.getState().videoEnabled) {
      setVideoStatus("starting");
      await startVideoTrackImmediately();
      return;
    }

    setStream((current) => {
      if (!current) {
        return null;
      }

      const audioTracks = current.getAudioTracks();
      current.getVideoTracks().forEach((track) => {
        track.stop();
      });
      setVideoStatus("off");
      return audioTracks.length ? new MediaStream(audioTracks) : null;
    });
  }, [setScreenSharing, startVideoTrackImmediately]);

  const stopScreenShare = useCallback(
    () => runMediaOperation(stopScreenShareImmediately),
    [runMediaOperation, stopScreenShareImmediately]
  );

  const startScreenShareImmediately = useCallback(async () => {
    updateScreenShareSupport();

    if (!window.isSecureContext && !isLocalhost(window.location.hostname)) {
      setScreenShareStatus("error");
      setError(getScreenShareUnavailableReason(t));
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenShareStatus("error");
      setError(getScreenShareUnavailableReason(t));
      return;
    }

    try {
      setScreenShareStatus("starting");
      const displayStream = await getDisplayMediaWithFallback();
      const screenTrack = displayStream.getVideoTracks()[0];

      if (!screenTrack) {
        stopMediaStream(displayStream);
        setScreenShareStatus("error");
        setError("error.couldNotStartScreenSharing");
        return;
      }

      screenTrackRef.current?.stop();
      screenTrackRef.current = screenTrack;
      setVideoContentHint(screenTrack, "detail");
      screenTrack.onended = () => {
        void stopScreenShare();
      };
      setVideoEnabled(false);
      setScreenSharing(true);
      setScreenShareStatus("ready");
      setVideoStatus("ready");
      setError(null);

      setStream((current) => {
        const audioTracks = current?.getAudioTracks() ?? [];
        current?.getVideoTracks().forEach((track) => {
          if (track !== screenTrack) {
            track.stop();
          }
        });
        return new MediaStream([...audioTracks, screenTrack]);
      });
    } catch {
      setScreenShareStatus("error");
      setError("error.couldNotStartScreenSharing");
    }
  }, [
    setError,
    setScreenSharing,
    setVideoEnabled,
    stopScreenShare,
    t,
    updateScreenShareSupport
  ]);

  const startScreenShare = useCallback(
    () => runMediaOperation(startScreenShareImmediately),
    [runMediaOperation, startScreenShareImmediately]
  );

  const toggleScreenShare = useCallback(() => {
    if (screenSharing) {
      void stopScreenShare();
      return;
    }

    void startScreenShare();
  }, [screenSharing, startScreenShare, stopScreenShare]);

  const toggleAudio = useCallback(() => {
    void runMediaOperation(async () => {
      const enabled = !useMediaStore.getState().audioEnabled;
      setAudioEnabled(enabled);

      if (enabled) {
        await startAudioTrackImmediately();
        return;
      }

      setAudioStatus("off");
      setStream((current) => streamWithoutKind(current, "audio"));
    });
  }, [runMediaOperation, setAudioEnabled, startAudioTrackImmediately]);

  const toggleVideo = useCallback(() => {
    if (screenSharing) {
      setVideoEnabled(true);
      setVideoStatus("starting");
      void stopScreenShare();
      return;
    }

    void runMediaOperation(async () => {
      const enabled = !useMediaStore.getState().videoEnabled;
      setVideoEnabled(enabled);

      if (enabled) {
        setVideoStatus("starting");
        await startVideoTrackImmediately();
        return;
      }

      setVideoStatus("off");
      setStream((current) => streamWithoutKind(current, "video"));
    });
  }, [
    runMediaOperation,
    screenSharing,
    setVideoEnabled,
    startVideoTrackImmediately,
    stopScreenShare
  ]);

  const setSelectedAudioDeviceId = useCallback(
    (deviceId: string) => {
      useMediaStore.getState().setSelectedAudioDeviceId(deviceId);

      if (!useMediaStore.getState().audioEnabled) {
        return;
      }

      void runMediaOperation(startAudioTrackImmediately);
    },
    [runMediaOperation, startAudioTrackImmediately]
  );

  const setSelectedVideoDeviceId = useCallback(
    (deviceId: string) => {
      useMediaStore.getState().setSelectedVideoDeviceId(deviceId);

      if (
        !useMediaStore.getState().videoEnabled ||
        useMediaStore.getState().screenSharing
      ) {
        return;
      }

      void runMediaOperation(startVideoTrackImmediately);
    },
    [runMediaOperation, startVideoTrackImmediately]
  );

  useEffect(() => {
    currentStreamRef.current = stream;
  }, [stream]);

  useEffect(
    () => () => {
      stopMediaStream(currentStreamRef.current);
    },
    []
  );

  useEffect(() => {
    updateScreenShareSupport();
  }, [updateScreenShareSupport]);

  useEffect(() => {
    void enumerateDevices();

    if (!navigator.mediaDevices) {
      return;
    }

    navigator.mediaDevices.addEventListener?.("devicechange", enumerateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener?.(
        "devicechange",
        enumerateDevices
      );
    };
  }, [enumerateDevices]);

  return {
    audioEnabled,
    audioInputs,
    audioStatus,
    error,
    isStarting,
    screenSharing,
    screenShareSupported,
    screenShareStatus,
    screenShareUnavailableReason,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    setSelectedAudioDeviceId,
    setSelectedVideoDeviceId,
    setScreenSharing,
    start,
    stop,
    stream,
    toggleAudio,
    toggleScreenShare,
    toggleVideo,
    videoStatus,
    videoInputs,
    videoEnabled
  };
}
