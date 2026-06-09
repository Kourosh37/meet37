"use client";

import { Shield, Crown, Mic, MicOff, Video, VideoOff } from "lucide-react";
import type { MeetingPeer } from "@/features/meeting/types/peer";
import { useLocale } from "@/providers/LocaleProvider";

interface ParticipantItemProps {
  canModerate?: boolean;
  canKick?: boolean;
  canKickPeer?: boolean;
  canManagePermissions?: boolean;
  isLocal?: boolean;
  onBlockedAction?: () => void;
  onKick?: (peerId: string) => void;
  onPermissions?: (peer: MeetingPeer) => void;
  peer: MeetingPeer;
}

export function ParticipantItem({
  canModerate = false,
  canKick = false,
  canKickPeer = true,
  canManagePermissions = true,
  isLocal = false,
  onBlockedAction,
  onKick,
  onPermissions,
  peer
}: ParticipantItemProps) {
  const { t } = useLocale();

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {peer.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="block max-w-full truncate text-sm font-semibold text-foreground">
            {peer.displayName}
            {isLocal ? ` (${t("common.you")})` : ""}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {peer.isHost ? (
              <Crown className="size-3.5" aria-label={t("common.host")} />
            ) : null}
            {peer.isAdmin ? (
              <Shield className="size-3.5" aria-label={t("common.admin")} />
            ) : null}
            {peer.media.audioEnabled ? (
              <Mic className="size-3.5" />
            ) : (
              <MicOff className="size-3.5" />
            )}
            {peer.media.videoEnabled ? (
              <Video className="size-3.5" />
            ) : (
              <VideoOff className="size-3.5" />
            )}
          </div>
        </div>
      </div>

      {canModerate && !isLocal ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition hover:bg-muted"
            onClick={() => {
              if (!canManagePermissions) {
                onBlockedAction?.();
                return;
              }
              onPermissions?.(peer);
            }}
            type="button"
          >
            {t("meeting.participantPermissions")}
          </button>
          {canKick ? (
            <button
              className="rounded-md border border-danger/30 px-2 py-1 text-xs font-medium text-danger transition hover:bg-danger/10"
              onClick={() => {
                if (!canKickPeer) {
                  onBlockedAction?.();
                  return;
                }
                onKick?.(peer.id);
              }}
              type="button"
            >
              {t("common.remove")}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
