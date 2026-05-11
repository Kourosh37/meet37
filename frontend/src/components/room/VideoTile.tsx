import { memo } from 'react';
import type { Track } from 'livekit-client';

import { MediaTrack } from './MediaTrack';

export type VideoTileData = {
  id: string;
  participantName: string;
  track?: Track;
  isLocal: boolean;
  isScreenShare: boolean;
};

function VideoTileBase({
  tile,
  onExpand,
}: {
  tile: VideoTileData;
  onExpand?: (tileId: string) => void;
}) {
  return (
    <article className="group relative h-full min-h-[200px] overflow-hidden rounded-3xl border border-[color:var(--border)] bg-black/60">
      {tile.track ? (
        <MediaTrack track={tile.track} muted={tile.isLocal} fit={tile.isScreenShare ? 'contain' : 'cover'} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black/70 text-center">
          <span className="px-4 text-sm font-semibold text-white/90">{tile.participantName}</span>
        </div>
      )}
      <div className="absolute inset-x-4 bottom-4 flex items-center justify-between">
        <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
          {tile.participantName}
        </span>
        <div className="flex items-center gap-2">
          {tile.isScreenShare ? (
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white/70">Screen</span>
          ) : null}
          <button
            type="button"
            className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white transition hover:bg-black/80"
            onClick={() => onExpand?.(tile.id)}
          >
            Maximize
          </button>
        </div>
      </div>
    </article>
  );
}

export const VideoTile = memo(VideoTileBase);
