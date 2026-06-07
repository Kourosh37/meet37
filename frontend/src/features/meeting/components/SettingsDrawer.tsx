"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type {
  BannedParticipant,
  PeerPermissions
} from "@/features/meeting/types/signaling";

const defaultPermissions: PeerPermissions = {
  can_chat: true,
  can_react: true,
  can_share_screen: true,
  can_use_camera: true,
  can_use_mic: true
};

interface SettingsDrawerProps {
  audioEnabled: boolean;
  bannedParticipants?: BannedParticipant[];
  canManageBans?: boolean;
  canShareScreen?: boolean;
  canUseCamera?: boolean;
  canUseMic?: boolean;
  isHost?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onToggleAudio: () => void;
  onToggleScreenShare: () => void;
  onToggleVideo: () => void;
  onListBans?: () => void;
  onUnbanPeer?: (banId: string) => void;
  onUpdateRoomSettings?: (settings: {
    joinPolicy?: "open" | "approval";
    password?: string;
    permissions?: PeerPermissions;
    applyToExisting?: boolean;
  }) => void;
  screenSharing: boolean;
  screenShareSupported?: boolean;
  screenShareUnavailableReason?: string;
  videoEnabled: boolean;
}

export function SettingsDrawer({
  audioEnabled,
  bannedParticipants = [],
  canManageBans = false,
  canShareScreen = true,
  canUseCamera = true,
  canUseMic = true,
  isHost = false,
  isOpen,
  onClose,
  onListBans,
  onToggleAudio,
  onToggleScreenShare,
  onToggleVideo,
  onUnbanPeer,
  onUpdateRoomSettings,
  screenSharing,
  screenShareSupported = true,
  screenShareUnavailableReason = "Screen sharing is not available in this browser.",
  videoEnabled
}: SettingsDrawerProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [joinPolicy, setJoinPolicy] = useState<"open" | "approval">("open");
  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [permissions, setPermissions] =
    useState<PeerPermissions>(defaultPermissions);
  const [applyToExisting, setApplyToExisting] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      if (canManageBans) {
        onListBans?.();
      }
      return;
    }

    const timeout = window.setTimeout(() => setShouldRender(false), 260);
    return () => window.clearTimeout(timeout);
  }, [canManageBans, isOpen, onListBans]);

  if (!shouldRender) {
    return null;
  }

  return (
    <aside
      className={
        isOpen
          ? "meet-settings-drawer-open fixed inset-y-0 right-0 z-40 w-[min(360px,100vw)] border-l border-border bg-surface p-4 shadow-xl"
          : "meet-settings-drawer-close fixed inset-y-0 right-0 z-40 w-[min(360px,100vw)] border-l border-border bg-surface p-4 shadow-xl"
      }
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-surface-foreground">
          Meeting settings
        </h2>
        <button
          aria-label="Close settings"
          className="grid size-9 place-items-center rounded-md border border-border text-foreground transition hover:bg-muted"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-6 grid gap-3">
        <button
          className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!audioEnabled && !canUseMic}
          onClick={onToggleAudio}
          type="button"
        >
          Microphone
          <span>{audioEnabled ? "On" : "Off"}</span>
        </button>
        <button
          className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!videoEnabled && !canUseCamera}
          onClick={onToggleVideo}
          type="button"
        >
          Camera
          <span>{videoEnabled ? "On" : "Off"}</span>
        </button>
        <button
          className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={
            !screenSharing && (!screenShareSupported || !canShareScreen)
          }
          onClick={onToggleScreenShare}
          title={
            screenSharing || screenShareSupported
              ? undefined
              : screenShareUnavailableReason
          }
          type="button"
        >
          Screen share
          <span>
            {screenSharing
              ? "On"
              : screenShareSupported
                ? "Off"
                : "Unavailable"}
          </span>
        </button>
      </div>

      {isHost ? (
        <section className="mt-6 border-t border-border pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Host controls
          </h3>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-medium text-foreground">
              Join policy
              <select
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                onChange={(event) =>
                  setJoinPolicy(event.target.value as "open" | "approval")
                }
                value={joinPolicy}
              >
                <option value="open">Open</option>
                <option value="approval">Host approval</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-foreground">
              Room password
              <input
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordTouched(true);
                }}
                placeholder="Leave empty to remove"
                type="password"
                value={password}
              />
            </label>
            <div className="grid gap-2 rounded-md border border-border p-3">
              {[
                ["can_use_mic", "Microphone"],
                ["can_use_camera", "Camera"],
                ["can_share_screen", "Screen share"],
                ["can_chat", "Chat"],
                ["can_react", "Reactions"]
              ].map(([key, label]) => (
                <label
                  className="flex items-center justify-between gap-3 text-sm text-foreground"
                  key={key}
                >
                  {label}
                  <input
                    checked={permissions[key as keyof PeerPermissions]}
                    className="size-4"
                    onChange={(event) =>
                      setPermissions((current) => ({
                        ...current,
                        [key]: event.target.checked
                      }))
                    }
                    type="checkbox"
                  />
                </label>
              ))}
            </div>
            <label className="flex items-center justify-between gap-3 text-sm text-foreground">
              Apply to current participants
              <input
                checked={applyToExisting}
                className="size-4"
                onChange={(event) => setApplyToExisting(event.target.checked)}
                type="checkbox"
              />
            </label>
            <button
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              onClick={() =>
                onUpdateRoomSettings?.({
                  applyToExisting,
                  joinPolicy,
                  password: passwordTouched ? password : undefined,
                  permissions
                })
              }
              type="button"
            >
              Save host controls
            </button>
          </div>
        </section>
      ) : null}

      {canManageBans ? (
        <section className="mt-6 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Banned participants
            </h3>
            <button
              className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-foreground transition hover:bg-muted"
              onClick={onListBans}
              type="button"
            >
              Refresh
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            {bannedParticipants.length ? (
              bannedParticipants.map((ban) => (
                <div
                  className="rounded-md border border-border bg-background p-3"
                  key={ban.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {ban.display_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ban.permanent
                          ? "Blocked permanently"
                          : `Blocked until ${new Date(
                              ban.banned_until * 1000
                            ).toLocaleString()}`}
                      </p>
                    </div>
                    <button
                      className="shrink-0 rounded-md border border-danger/30 px-2 py-1 text-xs font-semibold text-danger transition hover:bg-danger/10"
                      onClick={() => onUnbanPeer?.(ban.id)}
                      type="button"
                    >
                      Unban
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                No banned participants.
              </p>
            )}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
