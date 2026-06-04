"use client";

import { Camera, CameraOff, Mic, MicOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { useDeviceSetup } from "@/features/prejoin/hooks/useDeviceSetup";

export function DeviceSetup() {
  const setup = useDeviceSetup();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = setup.videoEnabled
        ? setup.previewStream
        : null;
    }
  }, [setup.previewStream, setup.videoEnabled]);

  return (
    <div className="space-y-4">
      <div className="aspect-video overflow-hidden rounded-lg border border-border bg-black">
        {setup.previewStream && setup.videoEnabled ? (
          <video
            autoPlay
            className="h-full w-full scale-x-[-1] object-contain"
            muted
            playsInline
            ref={videoRef}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-center text-slate-300">
            <div>
              <CameraOff className="mx-auto size-10" />
              <p className="mt-3 text-sm">Camera preview is off</p>
            </div>
          </div>
        )}
      </div>

      {setup.error ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {setup.error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-surface-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          disabled={setup.permissionState === "prompting"}
          onClick={() => setup.setAudioEnabled(!setup.audioEnabled)}
          type="button"
        >
          {setup.audioEnabled ? (
            <Mic className="size-4" />
          ) : (
            <MicOff className="size-4" />
          )}
          Mic
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-surface-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          disabled={setup.permissionState === "prompting"}
          onClick={() => setup.setVideoEnabled(!setup.videoEnabled)}
          type="button"
        >
          {setup.videoEnabled ? (
            <Camera className="size-4" />
          ) : (
            <CameraOff className="size-4" />
          )}
          Camera
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          onChange={(event) =>
            setup.setSelectedAudioDeviceId(event.target.value)
          }
          value={setup.selectedAudioDeviceId}
        >
          <option value="">Default microphone</option>
          {setup.audioInputs.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || "Microphone"}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          onChange={(event) =>
            setup.setSelectedVideoDeviceId(event.target.value)
          }
          value={setup.selectedVideoDeviceId}
        >
          <option value="">Default camera</option>
          {setup.videoInputs.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || "Camera"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
