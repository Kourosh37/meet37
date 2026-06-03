export function buildAudioConstraints(
  deviceId?: string
): MediaTrackConstraints {
  return {
    autoGainControl: true,
    channelCount: { ideal: 1 },
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: { ideal: 48000 },
    sampleSize: { ideal: 16 }
  };
}

export async function applyAudioTrackConstraints(track: MediaStreamTrack) {
  if (track.kind !== "audio" || !track.applyConstraints) {
    return;
  }

  await track
    .applyConstraints({
      autoGainControl: true,
      channelCount: { ideal: 1 },
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: { ideal: 48000 },
      sampleSize: { ideal: 16 }
    })
    .catch(() => undefined);
}

type AudioEncodingParameters = RTCRtpEncodingParameters & {
  dtx?: "disabled" | "enabled";
  networkPriority?: "high" | "low" | "medium" | "very-low";
  priority?: "high" | "low" | "medium" | "very-low";
};

export async function applyAudioSenderParameters(sender: RTCRtpSender) {
  if (sender.track?.kind !== "audio" || !sender.getParameters) {
    return;
  }

  const parameters = sender.getParameters();
  parameters.encodings = parameters.encodings?.length
    ? parameters.encodings
    : [{}];

  const encoding = parameters.encodings[0] as AudioEncodingParameters;
  encoding.maxBitrate = Math.max(encoding.maxBitrate ?? 0, 96_000);
  encoding.dtx = "disabled";
  encoding.priority = "high";
  encoding.networkPriority = "high";

  await sender.setParameters(parameters).catch(() => undefined);
}
