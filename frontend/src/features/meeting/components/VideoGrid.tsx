"use client";

import { useMemo, useState } from "react";
import { Minimize2 } from "lucide-react";
import { VideoTile } from "@/features/meeting/components/VideoTile";
import type { MeetingPeer } from "@/features/meeting/types/peer";
import type {
  MediaTrackStatus,
  PeerMode
} from "@/features/meeting/types/signaling";
import { cn } from "@/lib/utils/cn";

interface VideoGridProps {
  className?: string;
  local: {
    audioEnabled: boolean;
    audioStatus: MediaTrackStatus;
    displayName: string;
    isHost: boolean;
    screenSharing: boolean;
    screenShareStatus: MediaTrackStatus;
    stream: MediaStream | null;
    videoEnabled: boolean;
    videoStatus: MediaTrackStatus;
  };
  peers: Record<string, MeetingPeer>;
  remoteStreams: Record<string, MediaStream>;
}

type TileViewModel = {
  audioEnabled: boolean;
  audioStatus: MediaTrackStatus;
  displayName: string;
  id: string;
  isHost: boolean;
  isLocal: boolean;
  mode: PeerMode;
  screenSharing: boolean;
  screenShareStatus: MediaTrackStatus;
  stream: MediaStream | null;
  videoEnabled: boolean;
  videoStatus: MediaTrackStatus;
};

function getTilePriority(tile: TileViewModel) {
  if (tile.screenSharing) {
    return 0;
  }

  if (tile.videoEnabled) {
    return 1;
  }

  if (tile.audioEnabled) {
    return 2;
  }

  return 3;
}

export function VideoGrid({
  className,
  local,
  peers,
  remoteStreams
}: VideoGridProps) {
  const tiles = useMemo(() => {
    const unsortedTiles: TileViewModel[] = [
      {
        audioEnabled: local.audioEnabled,
        audioStatus: local.audioStatus,
        displayName: local.displayName,
        id: "local",
        isHost: local.isHost,
        isLocal: true,
        mode: "p2p",
        screenSharing: local.screenSharing,
        screenShareStatus: local.screenShareStatus,
        stream: local.stream,
        videoEnabled: local.videoEnabled,
        videoStatus: local.videoStatus
      },
      ...Object.values(peers).map((peer) => ({
        audioEnabled: peer.media.audioEnabled,
        audioStatus: peer.media.audioStatus,
        displayName: peer.displayName,
        id: peer.id,
        isHost: peer.isHost,
        isLocal: false,
        mode: peer.connection.mode,
        screenSharing: peer.media.screenSharing,
        screenShareStatus: peer.media.screenShareStatus,
        stream: remoteStreams[peer.id] ?? null,
        videoEnabled: peer.media.videoEnabled,
        videoStatus: peer.media.videoStatus
      }))
    ];

    return unsortedTiles
      .map((tile, index) => ({ index, tile }))
      .sort((first, second) => {
        const priorityDelta =
          getTilePriority(first.tile) - getTilePriority(second.tile);

        return priorityDelta || first.index - second.index;
      })
      .map(({ tile }) => tile);
  }, [local, peers, remoteStreams]);
  const [maximizedTileId, setMaximizedTileId] = useState<string | null>(null);
  const participantCount = tiles.length;
  const maximizedTile = tiles.find((tile) => tile.id === maximizedTileId);

  return (
    <>
      <section
        className={cn(
          "grid max-h-[calc(100svh-12rem)] min-h-[min(420px,calc(100svh-12rem))] content-start gap-px overflow-y-auto rounded-lg border border-border bg-border p-px sm:max-h-[calc(100vh-15rem)] sm:min-h-[420px]",
          participantCount <= 1 && "grid-cols-1",
          participantCount > 1 &&
            "grid-cols-1 auto-rows-[minmax(clamp(160px,52vw,280px),auto)] lg:grid-cols-2 lg:auto-rows-auto",
          className
        )}
      >
        {tiles.map((tile) => (
          <VideoTile
            audioEnabled={tile.audioEnabled}
            audioStatus={tile.audioStatus}
            displayName={tile.displayName}
            isHost={tile.isHost}
            isLocal={tile.isLocal}
            key={tile.id}
            className="rounded-none border-0 shadow-none"
            mode={tile.mode}
            onMaximize={() => setMaximizedTileId(tile.id)}
            screenSharing={tile.screenSharing}
            screenShareStatus={tile.screenShareStatus}
            stream={tile.stream}
            videoStatus={tile.videoStatus}
            videoEnabled={tile.videoEnabled}
          />
        ))}
      </section>

      {maximizedTile ? (
        <div className="fixed inset-0 z-50 grid bg-black/85 p-4 backdrop-blur-sm sm:p-6">
          <button
            aria-label="Minimize video"
            className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-md border border-white/20 bg-black/60 text-white shadow-lg transition hover:bg-black/80"
            onClick={() => setMaximizedTileId(null)}
            title="Minimize"
            type="button"
          >
            <Minimize2 className="size-5" />
          </button>
          <div className="m-auto w-full max-w-7xl">
            <VideoTile
              audioEnabled={maximizedTile.audioEnabled}
              audioStatus={maximizedTile.audioStatus}
              className="min-h-[min(78vh,720px)] rounded-lg border border-white/15 bg-black shadow-2xl"
              displayName={maximizedTile.displayName}
              isHost={maximizedTile.isHost}
              isLocal={maximizedTile.isLocal}
              mode={maximizedTile.mode}
              screenSharing={maximizedTile.screenSharing}
              screenShareStatus={maximizedTile.screenShareStatus}
              stream={maximizedTile.stream}
              videoStatus={maximizedTile.videoStatus}
              videoEnabled={maximizedTile.videoEnabled}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
