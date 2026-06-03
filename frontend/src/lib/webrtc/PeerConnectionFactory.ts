import type {
  IceCandidatePayload,
  SessionDescriptionPayload
} from "@/features/meeting/types/signaling";
import { applyAudioSenderParameters } from "@/lib/webrtc/audioQuality";
import { applyVideoSenderParameters } from "@/lib/webrtc/videoQuality";

const defaultIceServers: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302"] }
];

export interface PeerConnectionFactoryOptions {
  iceServers?: RTCIceServer[];
  onDataChannel?: (event: RTCDataChannelEvent) => void;
  onIceCandidate?: (candidate: IceCandidatePayload) => void;
  onTrack?: (event: RTCTrackEvent) => void;
}

export function createPeerConnection(
  options: PeerConnectionFactoryOptions = {}
) {
  const iceServers = buildIceServers(options.iceServers);
  const configs: RTCConfiguration[] = [
    {
      bundlePolicy: "max-bundle",
      iceCandidatePoolSize: 4,
      iceServers
    },
    {
      bundlePolicy: "max-bundle",
      iceServers
    },
    {
      iceServers
    }
  ];
  const connection = configs.reduce<RTCPeerConnection | null>(
    (created, config) => {
      if (created) {
        return created;
      }

      try {
        return new RTCPeerConnection(config);
      } catch {
        return null;
      }
    },
    null
  );

  if (!connection) {
    throw new Error("WebRTC peer connections are not supported.");
  }

  connection.onicecandidate = (event) => {
    if (!event.candidate) {
      return;
    }

    options.onIceCandidate?.(iceCandidateToPayload(event.candidate));
  };

  if (options.onTrack) {
    connection.ontrack = options.onTrack;
  }

  if (options.onDataChannel) {
    connection.ondatachannel = options.onDataChannel;
  }

  return connection;
}

export function buildIceServers(iceServers: RTCIceServer[] | undefined) {
  if (!iceServers?.length) {
    return defaultIceServers;
  }

  const seen = new Set<string>();
  const merged = [...defaultIceServers, ...iceServers].flatMap((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    const usableUrls = urls.filter((url) => {
      if (!url) {
        return false;
      }

      if (
        typeof window !== "undefined" &&
        !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) &&
        /(?:^|:)(?:127\.0\.0\.1|localhost|\[::1\])(?::|$)/i.test(url)
      ) {
        return false;
      }

      return true;
    });

    if (!usableUrls.length) {
      return [];
    }

    const key = JSON.stringify({
      credential: server.credential,
      urls: usableUrls,
      username: server.username
    });

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [{ ...server, urls: usableUrls }];
  });

  return merged.length ? merged : defaultIceServers;
}

export function addLocalTracks(
  connection: RTCPeerConnection,
  stream: MediaStream
) {
  return syncLocalTracks(connection, stream);
}

export function ensureRecvTransceivers(
  connection: RTCPeerConnection,
  counts: { audio?: number; video?: number } = {}
) {
  const transceivers = connection.getTransceivers();
  const ensureKind = (kind: "audio" | "video", desiredCount: number) => {
    const currentCount = transceivers.filter(
      (transceiver) =>
        transceiver.receiver.track.kind === kind &&
        transceiver.direction !== "inactive"
    ).length;

    for (let index = currentCount; index < desiredCount; index += 1) {
      connection.addTransceiver(kind, { direction: "recvonly" });
    }
  };

  ensureKind("audio", counts.audio ?? 4);
  ensureKind("video", counts.video ?? 8);
}

async function attachOrReplaceTrack(
  connection: RTCPeerConnection,
  stream: MediaStream,
  track: MediaStreamTrack
) {
  const senders = connection.getSenders();

  if (senders.some((sender) => sender.track?.id === track.id)) {
    return;
  }

  const reusableSender = senders.find(
    (sender) => senderKind(connection, sender) === track.kind
  );

  if (reusableSender) {
    try {
      enableSenderDirection(connection, reusableSender);
      await reusableSender.replaceTrack(track);
      await applySenderParameters(reusableSender);
      return;
    } catch (error) {
      void error;
    }
  }

  try {
    const sender = connection.addTrack(track, stream);
    await applySenderParameters(sender);
  } catch (error) {
    void error;
  }
}

function transceiverForSender(
  connection: RTCPeerConnection,
  sender: RTCRtpSender
) {
  return connection
    .getTransceivers()
    .find((transceiver) => transceiver.sender === sender);
}

function enableSenderDirection(
  connection: RTCPeerConnection,
  sender: RTCRtpSender
) {
  const transceiver = transceiverForSender(connection, sender);

  if (!transceiver) {
    return;
  }

  if (transceiver.direction === "recvonly") {
    transceiver.direction = "sendrecv";
    return;
  }

  if (transceiver.direction === "inactive") {
    transceiver.direction = "sendonly";
  }
}

function disableSenderDirection(
  connection: RTCPeerConnection,
  sender: RTCRtpSender
) {
  const transceiver = transceiverForSender(connection, sender);

  if (!transceiver) {
    return;
  }

  if (transceiver.direction === "sendrecv") {
    transceiver.direction = "recvonly";
    return;
  }

  if (transceiver.direction === "sendonly") {
    transceiver.direction = "inactive";
  }
}

function senderKind(
  connection: RTCPeerConnection,
  sender: RTCRtpSender
): MediaStreamTrack["kind"] | undefined {
  if (sender.track) {
    return sender.track.kind;
  }

  return connection
    .getTransceivers()
    .find((transceiver) => transceiver.sender === sender)?.receiver.track.kind;
}

export async function syncLocalTracks(
  connection: RTCPeerConnection,
  stream: MediaStream | null
) {
  const tracksByKind = new Map(
    stream?.getTracks().map((track) => [track.kind, track]) ?? []
  );
  const usedTrackIds = new Set<string>();

  for (const sender of connection.getSenders()) {
    const track = sender.track;
    const kind = senderKind(connection, sender);
    const replacement = kind ? tracksByKind.get(kind) : undefined;

    if (!replacement) {
      if (track) {
        await sender.replaceTrack(null).catch(() => undefined);
      }
      disableSenderDirection(connection, sender);
      continue;
    }

    if (usedTrackIds.has(replacement.id)) {
      await sender.replaceTrack(null).catch(() => undefined);
      disableSenderDirection(connection, sender);
      continue;
    }

    usedTrackIds.add(replacement.id);
    enableSenderDirection(connection, sender);
    if (!track || replacement.id !== track.id) {
      await sender.replaceTrack(replacement);
      await applySenderParameters(sender);
    } else {
      await applySenderParameters(sender);
    }
  }

  for (const track of stream?.getTracks() ?? []) {
    if (!usedTrackIds.has(track.id)) {
      if (!stream) {
        continue;
      }
      await attachOrReplaceTrack(connection, stream, track);
    }
  }
}

async function applySenderParameters(sender: RTCRtpSender) {
  await applyAudioSenderParameters(sender);
  await applyVideoSenderParameters(sender);
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function closePeerConnection(
  connection: RTCPeerConnection | null | undefined
) {
  connection?.close();
}

export function sessionDescriptionToPayload(
  description: RTCSessionDescriptionInit
) {
  return {
    sdp: description.sdp ?? ""
  } satisfies SessionDescriptionPayload;
}

export function payloadToSessionDescription(
  type: RTCSdpType,
  payload: SessionDescriptionPayload
) {
  return {
    sdp: payload.sdp,
    type
  } satisfies RTCSessionDescriptionInit;
}

export function iceCandidateToPayload(candidate: RTCIceCandidate) {
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex
  } satisfies IceCandidatePayload;
}

export function payloadToIceCandidate(payload: IceCandidatePayload) {
  return new RTCIceCandidate(payload);
}
