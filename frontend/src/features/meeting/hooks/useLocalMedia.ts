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

function isLocalhost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isIOSBrowser() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function getScreenShareUnavailableReason() {
  if (!window.isSecureContext && !isLocalhost(window.location.hostname)) {
    return "Screen sharing requires HTTPS on this browser.";
  }

  if (!navigator.mediaDevices?.getDisplayMedia && isIOSBrowser()) {
    return "Screen sharing is not supported in iPhone and iPad browsers. Use the desktop app/browser version, or join from a desktop browser such as Chrome, Edge, Safari, or Firefox to share your screen.";
  }

  if (!navigator.mediaDevices?.getDisplayMedia && isMobileBrowser()) {
    return "Screen sharing is not supported by this mobile browser. Use a desktop browser to share your screen, or keep joining from mobile for camera, microphone, chat, and viewing shared screens.";
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    return "Screen sharing is not supported by this browser or device. Try a current desktop browser such as Chrome, Edge, Safari, or Firefox.";
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
    useState("Screen sharing is not available in this browser.");
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
    setScreenShareUnavailableReason(getScreenShareUnavailableReason());
  }, []);

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
        setError("Media devices are not available in this browser.");
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
        const nextStream = await navigator.mediaDevices.getUserMedia({
          audio: shouldUseAudio ? buildAudioConstraints(audioDeviceId) : false,
          video: shouldUseVideo ? buildCameraConstraints(videoDeviceId) : false
        });

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
          shouldUseAudio && nextStream.getAudioTracks().length ? "ready" : "off"
        );
        setVideoStatus(
          shouldUseVideo && nextStream.getVideoTracks().length ? "ready" : "off"
        );

        setError(null);
        await enumerateDevices();
        return nextStream;
      } catch (error) {
        setAudioStatus(shouldUseAudio ? "error" : "off");
        setVideoStatus(shouldUseVideo ? "error" : "off");
        setError(
          error instanceof Error
            ? error.message
            : "Could not start local media."
        );
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
      setError("Media devices are not available in this browser.");
      return;
    }

    try {
      setAudioStatus("starting");
      const audioDeviceId = useMediaStore.getState().selectedAudioDeviceId;
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(audioDeviceId),
        video: false
      });
      const audioTracks = audioStream.getAudioTracks();

      if (!audioTracks.length) {
        stopMediaStream(audioStream);
        setAudioStatus("error");
        setError("Could not start local microphone.");
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
          current.removeTrack(track);
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
    } catch (error) {
      setAudioStatus("error");
      setError(
        error instanceof Error
          ? error.message
          : "Could not start local microphone."
      );
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
      await startImmediately({ videoEnabled: true });
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
      setVideoStatus("off");
      return new MediaStream(current.getTracks());
    });
  }, [setScreenSharing, startImmediately]);

  const stopScreenShare = useCallback(
    () => runMediaOperation(stopScreenShareImmediately),
    [runMediaOperation, stopScreenShareImmediately]
  );

  const startScreenShareImmediately = useCallback(async () => {
    updateScreenShareSupport();

    if (!window.isSecureContext && !isLocalhost(window.location.hostname)) {
      setScreenShareStatus("error");
      setError(getScreenShareUnavailableReason());
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenShareStatus("error");
      setError(getScreenShareUnavailableReason());
      return;
    }

    try {
      setScreenShareStatus("starting");
      const displayStream = await getDisplayMediaWithFallback();
      const screenTrack = displayStream.getVideoTracks()[0];

      if (!screenTrack) {
        stopMediaStream(displayStream);
        setScreenShareStatus("error");
        setError("Could not start screen sharing.");
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
          current.removeTrack(track);
          if (track !== screenTrack) {
            track.stop();
          }
        });
        return new MediaStream([...audioTracks, screenTrack]);
      });
    } catch (error) {
      setScreenShareStatus("error");
      setError(
        error instanceof Error
          ? error.message
          : "Could not start screen sharing."
      );
    }
  }, [
    setError,
    setScreenSharing,
    setVideoEnabled,
    stopScreenShare,
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
        await startImmediately({ videoEnabled: true });
        return;
      }

      setVideoStatus("off");
      setStream((current) => streamWithoutKind(current, "video"));
    });
  }, [
    runMediaOperation,
    screenSharing,
    setVideoEnabled,
    startImmediately,
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

      void runMediaOperation(() => startImmediately({ videoEnabled: true }));
    },
    [runMediaOperation, startImmediately]
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
