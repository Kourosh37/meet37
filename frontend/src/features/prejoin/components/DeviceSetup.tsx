"use client";

import { Camera, CameraOff, Mic, MicOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { DeviceSplitControl } from "@/features/meeting/components/DeviceSplitControl";
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
        <DeviceSplitControl
          activeIcon={<Mic className="size-4" />}
          defaultDeviceLabel="Default microphone"
          devices={setup.audioInputs}
          disabled={setup.permissionState === "prompting"}
          inactiveIcon={<MicOff className="size-4" />}
          isEnabled={setup.audioEnabled}
          label="Mic"
          onSelectDevice={setup.setSelectedAudioDeviceId}
          onToggle={() => setup.setAudioEnabled(!setup.audioEnabled)}
          selectLabel="Select microphone"
          selectedDeviceId={setup.selectedAudioDeviceId}
          toggleLabel={
            setup.audioEnabled ? "Mute microphone" : "Unmute microphone"
          }
          variant="labeled"
        />
        <DeviceSplitControl
          activeIcon={<Camera className="size-4" />}
          defaultDeviceLabel="Default camera"
          devices={setup.videoInputs}
          disabled={setup.permissionState === "prompting"}
          inactiveIcon={<CameraOff className="size-4" />}
          isEnabled={setup.videoEnabled}
          label="Camera"
          onSelectDevice={setup.setSelectedVideoDeviceId}
          onToggle={() => setup.setVideoEnabled(!setup.videoEnabled)}
          selectLabel="Select camera"
          selectedDeviceId={setup.selectedVideoDeviceId}
          toggleLabel={
            setup.videoEnabled ? "Turn camera off" : "Turn camera on"
          }
          variant="labeled"
        />
      </div>
    </div>
  );
}
