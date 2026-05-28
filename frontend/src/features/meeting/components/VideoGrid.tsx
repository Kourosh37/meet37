"use client";

import { VideoTile } from "@/features/meeting/components/VideoTile";
import type { MeetingPeer } from "@/features/meeting/types/peer";
import { cn } from "@/lib/utils/cn";

interface VideoGridProps {
  className?: string;
  local: {
    audioEnabled: boolean;
    displayName: string;
    isHost: boolean;
    screenSharing: boolean;
    stream: MediaStream | null;
    videoEnabled: boolean;
  };
  peers: Record<string, MeetingPeer>;
  remoteStreams: Record<string, MediaStream>;
}

export function VideoGrid({
  className,
  local,
  peers,
  remoteStreams
}: VideoGridProps) {
  const remotePeers = Object.values(peers);
  const participantCount = remotePeers.length + 1;

  return (
    <section
      className={cn(
        "grid min-h-0 flex-1 gap-3",
        participantCount <= 1 && "grid-cols-1",
        participantCount === 2 && "grid-cols-1 lg:grid-cols-2",
        participantCount > 2 && "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
        className
      )}
    >
      <VideoTile
        audioEnabled={local.audioEnabled}
        displayName={local.displayName}
        isHost={local.isHost}
        isLocal
        mode="p2p"
        screenSharing={local.screenSharing}
        stream={local.stream}
        videoEnabled={local.videoEnabled}
      />
      {remotePeers.map((peer) => (
        <VideoTile
          audioEnabled={peer.media.audioEnabled}
          displayName={peer.displayName}
          isHost={peer.isHost}
          key={peer.id}
          mode={peer.connection.mode}
          screenSharing={peer.media.screenSharing}
          stream={remoteStreams[peer.id] ?? null}
          videoEnabled={peer.media.videoEnabled}
        />
      ))}
    </section>
  );
}
