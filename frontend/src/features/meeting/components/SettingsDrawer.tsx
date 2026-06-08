"use client";

import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
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

type SettingsSection = "meeting" | "host" | "bans";

function AccordionSection({
  children,
  id,
  isOpen,
  onToggle,
  title
}: {
  children: ReactNode;
  id: SettingsSection;
  isOpen: boolean;
  onToggle: (id: SettingsSection) => void;
  title: string;
}) {
  return (
    <section className="rounded-md border border-border bg-background/60">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:bg-muted/70"
        onClick={() => onToggle(id)}
        type="button"
      >
        {title}
        <ChevronDown
          className={
            isOpen
              ? "size-4 shrink-0 rotate-180 transition-transform duration-300"
              : "size-4 shrink-0 transition-transform duration-300"
          }
        />
      </button>
      <div
        className={
          isOpen
            ? "grid grid-rows-[1fr] opacity-100 transition-all duration-300 ease-out"
            : "grid grid-rows-[0fr] opacity-0 transition-all duration-300 ease-out"
        }
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-border p-3">{children}</div>
        </div>
      </div>
    </section>
  );
}

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
  const [openSections, setOpenSections] = useState<Set<SettingsSection>>(
    () => new Set(["meeting"])
  );

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

  function toggleSection(id: SettingsSection) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <aside
      className={
        isOpen
          ? "meet-settings-drawer-open fixed bottom-[4.25rem] right-0 top-0 z-40 flex w-[min(380px,100vw)] flex-col border-l border-border bg-surface shadow-xl sm:bottom-[4.75rem] lg:inset-y-0"
          : "meet-settings-drawer-close fixed bottom-[4.25rem] right-0 top-0 z-40 flex w-[min(380px,100vw)] flex-col border-l border-border bg-surface shadow-xl sm:bottom-[4.75rem] lg:inset-y-0"
      }
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
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
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-3 pb-6">
          <AccordionSection
            id="meeting"
            isOpen={openSections.has("meeting")}
            onToggle={toggleSection}
            title="Meeting controls"
          >
            <div className="grid gap-3">
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
          </AccordionSection>

          {isHost ? (
            <AccordionSection
              id="host"
              isOpen={openSections.has("host")}
              onToggle={toggleSection}
              title="Host controls"
            >
              <div className="grid gap-3">
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
                    onChange={(event) =>
                      setApplyToExisting(event.target.checked)
                    }
                    type="checkbox"
                  />
                </label>
                <button
                  className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                  onClick={() => {
                    onUpdateRoomSettings?.({
                      applyToExisting,
                      joinPolicy,
                      password: passwordTouched ? password : undefined,
                      permissions
                    });
                    toast.success("Meeting settings saved");
                  }}
                  type="button"
                >
                  Save host controls
                </button>
              </div>
            </AccordionSection>
          ) : null}

          {canManageBans ? (
            <AccordionSection
              id="bans"
              isOpen={openSections.has("bans")}
              onToggle={toggleSection}
              title="Banned participants"
            >
              <div className="flex items-center justify-end">
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
                          onClick={() => {
                            onUnbanPeer?.(ban.id);
                            toast.success("Participant unbanned");
                          }}
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
            </AccordionSection>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
