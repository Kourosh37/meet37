"use client";

import { Camera, CameraOff, Mic, MicOff } from "lucide-react";
import { FittedVideo } from "@/components/media/FittedVideo";
import { InlineError } from "@/components/feedback/InlineError";
import { DeviceSplitControl } from "@/features/meeting/components/DeviceSplitControl";
import { useDeviceSetup } from "@/features/prejoin/hooks/useDeviceSetup";
import { useLocale } from "@/providers/LocaleProvider";

export function DeviceSetup() {
  const setup = useDeviceSetup();
  const { t } = useLocale();

  return (
    <div className="space-y-4">
      <div className="aspect-video overflow-hidden rounded-lg border border-border bg-black">
        {setup.previewStream && setup.videoEnabled ? (
          <FittedVideo
            deferUntilReady
            mirrored
            muted
            stream={setup.previewStream}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-center text-slate-300">
            <div>
              <CameraOff className="mx-auto size-10" />
              <p className="mt-3 text-sm">{t("meeting.cameraPreviewOff")}</p>
            </div>
          </div>
        )}
      </div>

      <InlineError message={setup.error} />

      <div className="flex flex-wrap gap-2">
        <DeviceSplitControl
          activeIcon={<Mic className="size-4" />}
          defaultDeviceLabel={t("meeting.defaultMicrophone")}
          devices={setup.audioInputs}
          disabled={setup.permissionState === "prompting"}
          inactiveIcon={<MicOff className="size-4" />}
          isEnabled={setup.audioEnabled}
          label={t("meeting.microphone")}
          onSelectDevice={setup.setSelectedAudioDeviceId}
          onToggle={() => setup.setAudioEnabled(!setup.audioEnabled)}
          selectLabel={t("meeting.selectMicrophone")}
          selectedDeviceId={setup.selectedAudioDeviceId}
          toggleLabel={
            setup.audioEnabled
              ? t("meeting.muteMicrophone")
              : t("meeting.unmuteMicrophone")
          }
          variant="labeled"
        />
        <DeviceSplitControl
          activeIcon={<Camera className="size-4" />}
          defaultDeviceLabel={t("meeting.defaultCamera")}
          devices={setup.videoInputs}
          disabled={setup.permissionState === "prompting"}
          inactiveIcon={<CameraOff className="size-4" />}
          isEnabled={setup.videoEnabled}
          label={t("meeting.camera")}
          onSelectDevice={setup.setSelectedVideoDeviceId}
          onToggle={() => setup.setVideoEnabled(!setup.videoEnabled)}
          selectLabel={t("meeting.selectCamera")}
          selectedDeviceId={setup.selectedVideoDeviceId}
          toggleLabel={
            setup.videoEnabled
              ? t("meeting.turnCameraOff")
              : t("meeting.turnCameraOn")
          }
          variant="labeled"
        />
      </div>
    </div>
  );
}
