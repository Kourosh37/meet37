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
    audioLevel: number;
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
  audioLevels?: Record<string, number>;
  remoteStreams: Record<string, MediaStream>;
}

type TileViewModel = {
  audioEnabled: boolean;
  audioLevel: number;
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
  audioLevels = {},
  className,
  local,
  peers,
  remoteStreams
}: VideoGridProps) {
  const tiles = useMemo(() => {
    const unsortedTiles: TileViewModel[] = [
      {
        audioEnabled: local.audioEnabled,
        audioLevel: local.audioLevel,
        audioStatus: local.audioStatus,
        displayName: local.displayName,
        id: "local",
        isHost: local.isHost,
        isLocal: true,
        mode: "sfu",
        screenSharing: local.screenSharing,
        screenShareStatus: local.screenShareStatus,
        stream: local.stream,
        videoEnabled: local.videoEnabled,
        videoStatus: local.videoStatus
      },
      ...Object.values(peers).map((peer) => ({
        audioEnabled: peer.media.audioEnabled,
        audioLevel: audioLevels[peer.id] ?? 0,
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
  }, [audioLevels, local, peers, remoteStreams]);
  const [maximizedTileId, setMaximizedTileId] = useState<string | null>(null);
  const participantCount = tiles.length;
  const maximizedTile = tiles.find((tile) => tile.id === maximizedTileId);

  return (
    <>
      <section
        className={cn(
          "grid min-h-[min(420px,calc(100svh-12rem))] items-stretch gap-px overflow-visible bg-border lg:max-h-[calc(100vh-17rem)] lg:min-h-[360px] lg:overflow-y-auto lg:rounded-lg lg:border lg:border-border lg:p-px",
          participantCount <= 1 && "grid-cols-1 auto-rows-fr",
          participantCount > 1 &&
            "grid-cols-1 auto-rows-[clamp(180px,52vw,300px)] lg:grid-cols-2 lg:auto-rows-[clamp(180px,24vw,280px)]",
          className
        )}
      >
        {tiles.map((tile) => (
          <VideoTile
            audioEnabled={tile.audioEnabled}
            audioLevel={tile.audioLevel}
            audioStatus={tile.audioStatus}
            displayName={tile.displayName}
            fillContainer
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
        <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/85 p-3 backdrop-blur-sm sm:p-6">
          <button
            aria-label="Minimize video"
            className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-md border border-white/20 bg-black/60 text-white shadow-lg transition hover:bg-black/80"
            onClick={() => setMaximizedTileId(null)}
            title="Minimize"
            type="button"
          >
            <Minimize2 className="size-5" />
          </button>
          <div className="grid h-[calc(100svh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[80rem] place-items-center [--meet-tile-max-h:calc(100svh-1.5rem)] sm:h-[calc(100vh-3rem)] sm:w-[calc(100vw-3rem)] sm:[--meet-tile-max-h:calc(100vh-3rem)]">
            <VideoTile
              audioEnabled={maximizedTile.audioEnabled}
              audioLevel={maximizedTile.audioLevel}
              audioStatus={maximizedTile.audioStatus}
              className="rounded-lg border border-white/15 bg-black shadow-2xl"
              displayName={maximizedTile.displayName}
              isHost={maximizedTile.isHost}
              isLocal={maximizedTile.isLocal}
              isMaximized
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
