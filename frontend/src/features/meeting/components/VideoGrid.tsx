"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { VideoTile } from "@/features/meeting/components/VideoTile";
import type { MeetingPeer } from "@/features/meeting/types/peer";
import type { PeerMode } from "@/features/meeting/types/signaling";
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
  const tiles = useMemo(
    () => [
      {
        audioEnabled: local.audioEnabled,
        displayName: local.displayName,
        id: "local",
        isHost: local.isHost,
        isLocal: true,
        mode: "p2p" as PeerMode,
        screenSharing: local.screenSharing,
        stream: local.stream,
        videoEnabled: local.videoEnabled
      },
      ...Object.values(peers).map((peer) => ({
        audioEnabled: peer.media.audioEnabled,
        displayName: peer.displayName,
        id: peer.id,
        isHost: peer.isHost,
        isLocal: false,
        mode: peer.connection.mode,
        screenSharing: peer.media.screenSharing,
        stream: remoteStreams[peer.id] ?? null,
        videoEnabled: peer.media.videoEnabled
      }))
    ],
    [local, peers, remoteStreams]
  );
  const [maximizedTileId, setMaximizedTileId] = useState<string | null>(null);
  const participantCount = tiles.length;
  const maximizedTile = tiles.find((tile) => tile.id === maximizedTileId);

  return (
    <>
      <section
        className={cn(
          "grid min-h-[420px] content-start gap-px overflow-hidden rounded-lg border border-border bg-border p-px",
          participantCount <= 1 && "grid-cols-1",
          participantCount > 1 && "grid-cols-1 lg:grid-cols-2",
          className
        )}
      >
        {tiles.map((tile) => (
          <VideoTile
            audioEnabled={tile.audioEnabled}
            displayName={tile.displayName}
            isHost={tile.isHost}
            isLocal={tile.isLocal}
            key={tile.id}
            className="rounded-none border-0 shadow-none"
            mode={tile.mode}
            onMaximize={() => setMaximizedTileId(tile.id)}
            screenSharing={tile.screenSharing}
            stream={tile.stream}
            videoEnabled={tile.videoEnabled}
          />
        ))}
      </section>

      {maximizedTile ? (
        <div className="fixed inset-0 z-50 grid bg-black/85 p-4 backdrop-blur-sm sm:p-6">
          <button
            aria-label="Close maximized video"
            className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-md border border-white/20 bg-black/60 text-white shadow-lg transition hover:bg-black/80"
            onClick={() => setMaximizedTileId(null)}
            type="button"
          >
            <X className="size-5" />
          </button>
          <div className="m-auto w-full max-w-7xl">
            <VideoTile
              audioEnabled={maximizedTile.audioEnabled}
              className="min-h-[min(78vh,720px)] rounded-lg border border-white/15 bg-black shadow-2xl"
              displayName={maximizedTile.displayName}
              isHost={maximizedTile.isHost}
              isLocal={maximizedTile.isLocal}
              mode={maximizedTile.mode}
              screenSharing={maximizedTile.screenSharing}
              stream={maximizedTile.stream}
              videoEnabled={maximizedTile.videoEnabled}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
