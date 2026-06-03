const CAMERA_MAX_BITRATE = 520_000;
const SCREEN_MAX_BITRATE = 900_000;
const WARNING_CAMERA_MAX_BITRATE = 320_000;
const WARNING_SCREEN_MAX_BITRATE = 620_000;
const POOR_CAMERA_MAX_BITRATE = 180_000;
const POOR_SCREEN_MAX_BITRATE = 340_000;

type VideoEncodingParameters = RTCRtpEncodingParameters & {
  networkPriority?: "high" | "low" | "medium" | "very-low";
  priority?: "high" | "low" | "medium" | "very-low";
};

type VideoRtpParameters = RTCRtpSendParameters & {
  degradationPreference?: "balanced" | "maintain-framerate" | "maintain-resolution";
};

export function buildCameraConstraints(
  deviceId?: string
): MediaTrackConstraints {
  return {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    facingMode: deviceId ? undefined : { ideal: "user" },
    frameRate: { ideal: 18, max: 20 }
  };
}

export function buildScreenShareConstraints(): MediaTrackConstraints {
  return {
    frameRate: { ideal: 12, max: 15 },
    height: { ideal: 720, max: 1080 },
    width: { ideal: 1280, max: 1920 }
  };
}

export function setVideoContentHint(
  track: MediaStreamTrack,
  hint: "detail" | "motion"
) {
  try {
    track.contentHint = hint;
  } catch {
    return;
  }
}

export async function applyVideoTrackConstraints(
  track: MediaStreamTrack,
  screenSharing = false
) {
  if (track.kind !== "video" || !track.applyConstraints) {
    return;
  }

  if (screenSharing) {
    await track
      .applyConstraints(buildScreenShareConstraints())
      .catch(() => undefined);
    return;
  }

  const settings = track.getSettings();
  const width = settings.width ?? 0;
  const height = settings.height ?? 0;
  const portrait = height > width;

  await track
    .applyConstraints({
      frameRate: { ideal: 18, max: 20 },
      height: portrait ? { max: 1280 } : { max: 720 },
      width: portrait ? { max: 720 } : { max: 1280 }
    })
    .catch(() => undefined);
}

export async function applyVideoSenderParameters(sender: RTCRtpSender) {
  if (sender.track?.kind !== "video" || !sender.getParameters) {
    return;
  }

  const isScreenShare = isScreenShareTrack(sender.track);
  await setVideoSenderEncoding(sender, {
    maxBitrate: isScreenShare ? SCREEN_MAX_BITRATE : CAMERA_MAX_BITRATE,
    maxFramerate: isScreenShare ? 12 : 18,
    scaleResolutionDownBy: 1
  });
}

export async function applyConnectionVideoQuality(
  connections: Iterable<RTCPeerConnection>,
  quality: "good" | "poor" | "warning"
) {
  const updates: Promise<void>[] = [];

  for (const connection of connections) {
    for (const sender of connection.getSenders()) {
      if (sender.track?.kind !== "video") {
        continue;
      }

      const isScreenShare = isScreenShareTrack(sender.track);
      if (quality === "poor") {
        updates.push(
          setVideoSenderEncoding(sender, {
            maxBitrate: isScreenShare
              ? POOR_SCREEN_MAX_BITRATE
              : POOR_CAMERA_MAX_BITRATE,
            maxFramerate: isScreenShare ? 6 : 8,
            scaleResolutionDownBy: isScreenShare ? 1.5 : 3
          })
        );
        continue;
      }

      if (quality === "warning") {
        updates.push(
          setVideoSenderEncoding(sender, {
            maxBitrate: isScreenShare
              ? WARNING_SCREEN_MAX_BITRATE
              : WARNING_CAMERA_MAX_BITRATE,
            maxFramerate: isScreenShare ? 8 : 12,
            scaleResolutionDownBy: isScreenShare ? 1.25 : 2
          })
        );
        continue;
      }

      updates.push(
        setVideoSenderEncoding(sender, {
          maxBitrate: isScreenShare ? SCREEN_MAX_BITRATE : CAMERA_MAX_BITRATE,
          maxFramerate: isScreenShare ? 12 : 18,
          scaleResolutionDownBy: 1
        })
      );
    }
  }

  await Promise.all(updates);
}

function isScreenShareTrack(track: MediaStreamTrack) {
  return (
    track.contentHint === "detail" ||
    track.label.toLowerCase().includes("screen") ||
    track.label.toLowerCase().includes("display")
  );
}

async function setVideoSenderEncoding(
  sender: RTCRtpSender,
  options: {
    maxBitrate: number;
    maxFramerate: number;
    scaleResolutionDownBy: number;
  }
) {
  if (sender.track?.kind !== "video" || !sender.getParameters) {
    return;
  }

  const parameters = sender.getParameters() as VideoRtpParameters;
  parameters.encodings = parameters.encodings?.length
    ? parameters.encodings
    : [{}];

  const isScreenShare = isScreenShareTrack(sender.track);
  const encoding = parameters.encodings[0] as VideoEncodingParameters;
  encoding.maxBitrate = options.maxBitrate;
  encoding.maxFramerate = options.maxFramerate;
  encoding.scaleResolutionDownBy = options.scaleResolutionDownBy;
  encoding.priority = "medium";
  encoding.networkPriority = "medium";
  parameters.degradationPreference = isScreenShare
    ? "maintain-resolution"
    : "maintain-framerate";

  await sender.setParameters(parameters).catch(() => undefined);
}
