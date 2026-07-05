"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import type {
  BannedParticipant,
  PeerPermissions
} from "@/features/meeting/types/signaling";
import { useLocale } from "@/providers/LocaleProvider";

const defaultPermissions: PeerPermissions = {
  can_chat: true,
  can_react: true,
  can_share_screen: true,
  can_use_camera: true,
  can_use_mic: true
};

type SettingsSection = "host" | "bans";

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
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:bg-muted/70"
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
  bannedParticipants?: BannedParticipant[];
  canManageBans?: boolean;
  isHost?: boolean;
  isOpen: boolean;
  joinPolicy?: "open" | "approval";
  onClose: () => void;
  onListBans?: () => void;
  onUnbanPeer?: (banId: string) => void;
  onUpdateRoomSettings?: (settings: {
    joinPolicy?: "open" | "approval";
    password?: string;
    permissions?: PeerPermissions;
    applyToExisting?: boolean;
  }) => void;
}

export function SettingsDrawer({
  bannedParticipants = [],
  canManageBans = false,
  isHost = false,
  isOpen,
  joinPolicy: initialJoinPolicy = "open",
  onClose,
  onListBans,
  onUnbanPeer,
  onUpdateRoomSettings
}: SettingsDrawerProps) {
  const { t } = useLocale();
  const panelRef = useRef<HTMLElement | null>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [joinPolicy, setJoinPolicy] = useState<"open" | "approval">(
    initialJoinPolicy
  );
  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [permissions, setPermissions] =
    useState<PeerPermissions>(defaultPermissions);
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [openSections, setOpenSections] = useState<Set<SettingsSection>>(
    () => new Set(["host", "bans"])
  );

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setJoinPolicy(initialJoinPolicy);
      if (canManageBans) {
        onListBans?.();
      }
      return;
    }

    const timeout = window.setTimeout(() => setShouldRender(false), 260);
    return () => window.clearTimeout(timeout);
  }, [canManageBans, initialJoinPolicy, isOpen, onListBans]);

  useEffect(() => {
    if (!isOpen || !shouldRender) {
      return;
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;

      if (target instanceof Node && !panelRef.current?.contains(target)) {
        onClose();
      }
    }

    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [isOpen, onClose, shouldRender]);

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
      ref={panelRef}
      className={
        isOpen
          ? "meet-settings-drawer-open fixed bottom-[8rem] end-0 top-0 z-40 flex w-[min(380px,100vw)] flex-col border-s border-border bg-surface shadow-xl sm:bottom-[4.75rem] lg:inset-y-0"
          : "meet-settings-drawer-close fixed bottom-[8rem] end-0 top-0 z-40 flex w-[min(380px,100vw)] flex-col border-s border-border bg-surface shadow-xl sm:bottom-[4.75rem] lg:inset-y-0"
      }
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
        <h2 className="text-sm font-semibold text-surface-foreground">
          {t("meeting.meetingSettings")}
        </h2>
        <button
          aria-label={t("meeting.closeSettings")}
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
            id="host"
            isOpen={openSections.has("host")}
            onToggle={toggleSection}
            title={t("meeting.hostControls")}
          >
            <div className={isHost ? "grid gap-3" : "grid gap-3 opacity-45"}>
              <label className="grid gap-1 text-sm font-medium text-foreground">
                {t("room.joinPolicy")}
                <select
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  disabled={!isHost}
                  onChange={(event) =>
                    setJoinPolicy(event.target.value as "open" | "approval")
                  }
                  value={joinPolicy}
                >
                  <option value="open">{t("common.open")}</option>
                  <option value="approval">{t("meeting.hostApproval")}</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-foreground">
                {t("room.roomPassword")}
                <input
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  disabled={!isHost}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setPasswordTouched(true);
                  }}
                  placeholder={t("meeting.leaveEmptyToRemove")}
                  type="password"
                  value={password}
                />
              </label>
              <div className="grid gap-2 rounded-md border border-border p-3">
                {[
                  ["can_use_mic", t("meeting.microphone")],
                  ["can_use_camera", t("meeting.camera")],
                  ["can_share_screen", t("meeting.shareScreen")],
                  ["can_chat", t("meeting.chat")],
                  ["can_react", t("meeting.sendReaction")]
                ].map(([key, label]) => (
                  <label
                    className="flex items-center justify-between gap-3 text-sm text-foreground"
                    key={key}
                  >
                    {label}
                    <input
                      checked={permissions[key as keyof PeerPermissions]}
                      className="size-4"
                      disabled={!isHost}
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
                {t("meeting.applyToCurrentParticipants")}
                <input
                  checked={applyToExisting}
                  className="size-4"
                  disabled={!isHost}
                  onChange={(event) => setApplyToExisting(event.target.checked)}
                  type="checkbox"
                />
              </label>
              <button
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isHost}
                onClick={() => {
                  onUpdateRoomSettings?.({
                    applyToExisting,
                    joinPolicy,
                    password: passwordTouched ? password : undefined,
                    permissions
                  });
                  toast.success(t("meeting.permissionsSaved"));
                }}
                type="button"
              >
                {t("meeting.saveHostControls")}
              </button>
            </div>
          </AccordionSection>

          <AccordionSection
            id="bans"
            isOpen={openSections.has("bans")}
            onToggle={toggleSection}
            title={t("meeting.bannedParticipants")}
          >
            <div
              className={canManageBans ? "grid gap-4" : "grid gap-4 opacity-45"}
            >
              <div className="flex items-center justify-end">
                <button
                  className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canManageBans}
                  onClick={onListBans}
                  type="button"
                >
                  {t("common.refresh")}
                </button>
              </div>
              <div className="grid gap-2">
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
                              ? t("meeting.blockedPermanently")
                              : t("meeting.blockedUntil", {
                                  date: new Date(
                                    ban.banned_until * 1000
                                  ).toLocaleString()
                                })}
                          </p>
                        </div>
                        <button
                          className="shrink-0 rounded-md border border-danger/30 px-2 py-1 text-xs font-semibold text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!canManageBans}
                          onClick={() => {
                            onUnbanPeer?.(ban.id);
                            toast.success(t("meeting.participantUnbanned"));
                          }}
                          type="button"
                        >
                          {t("meeting.unban")}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    {t("meeting.emptyBans")}
                  </p>
                )}
              </div>
            </div>
          </AccordionSection>
        </div>
      </div>
    </aside>
  );
}
