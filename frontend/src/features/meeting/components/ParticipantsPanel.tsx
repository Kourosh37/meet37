"use client";

import { useEffect, useState } from "react";
import { ParticipantItem } from "@/features/meeting/components/ParticipantItem";
import type { MeetingPeer, PendingPeer } from "@/features/meeting/types/peer";
import type {
  AdminPermissions,
  PeerPermissions
} from "@/features/meeting/types/signaling";

const defaultPeerPermissions: PeerPermissions = {
  can_chat: true,
  can_react: true,
  can_share_screen: true,
  can_use_camera: true,
  can_use_mic: true
};

const defaultAdminPermissions: AdminPermissions = {
  can_disable_camera: true,
  can_disable_chat: true,
  can_disable_emoji: true,
  can_disable_screen: true,
  can_kick: true,
  can_mute_mic: true
};

interface ParticipantsPanelProps {
  canModerate: boolean;
  canAssignAdmin?: boolean;
  canKick?: boolean;
  localPeer: MeetingPeer;
  onApprove: (peerId: string) => void;
  onKick: (
    peerId: string,
    reason?: string,
    banMinutes?: number,
    banPermanent?: boolean
  ) => void;
  onSetAdminPermissions?: (
    peerId: string,
    isAdmin: boolean,
    permissions: AdminPermissions
  ) => void;
  onSetPeerPermissions?: (peerId: string, permissions: PeerPermissions) => void;
  onReject: (peerId: string) => void;
  peers: Record<string, MeetingPeer>;
  pendingPeers: PendingPeer[];
}

export function ParticipantsPanel({
  canModerate,
  canAssignAdmin = false,
  canKick = false,
  localPeer,
  onApprove,
  onKick,
  onSetAdminPermissions,
  onSetPeerPermissions,
  onReject,
  peers,
  pendingPeers
}: ParticipantsPanelProps) {
  const [permissionPeer, setPermissionPeer] = useState<MeetingPeer | null>(
    null
  );
  const [permissionDraft, setPermissionDraft] = useState<PeerPermissions>(
    defaultPeerPermissions
  );
  const [adminPeer, setAdminPeer] = useState<MeetingPeer | null>(null);
  const [adminEnabled, setAdminEnabled] = useState(false);
  const [adminDraft, setAdminDraft] = useState<AdminPermissions>(
    defaultAdminPermissions
  );
  const [kickPeer, setKickPeer] = useState<MeetingPeer | null>(null);
  const [banMinutes, setBanMinutes] = useState(0);
  const [banPermanent, setBanPermanent] = useState(false);

  useEffect(() => {
    if (!permissionPeer) {
      return;
    }
    setPermissionDraft(permissionPeer.permissions ?? defaultPeerPermissions);
  }, [permissionPeer]);

  useEffect(() => {
    if (!adminPeer) {
      return;
    }
    setAdminEnabled(Boolean(adminPeer.isAdmin));
    setAdminDraft(adminPeer.adminPermissions ?? defaultAdminPermissions);
  }, [adminPeer]);

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-surface-foreground">
          Participants
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {Object.keys(peers).length + 1} in call
        </p>
      </div>

      {canModerate && pendingPeers.length > 0 ? (
        <section className="mt-4 rounded-md border border-primary/30 bg-primary/10 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
            Waiting
          </h3>
          <div className="mt-3 grid gap-2">
            {pendingPeers.map((peer) => (
              <div key={peer.id} className="rounded-md bg-surface p-2">
                <p className="truncate text-sm font-medium text-surface-foreground">
                  {peer.displayName}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                    onClick={() => onApprove(peer.id)}
                    type="button"
                  >
                    Admit
                  </button>
                  <button
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-foreground"
                    onClick={() => onReject(peer.id)}
                    type="button"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ul className="mt-4 grid min-h-0 gap-2 overflow-y-auto">
        <ParticipantItem canModerate={canModerate} isLocal peer={localPeer} />
        {Object.values(peers).map((peer) => (
          <ParticipantItem
            canAssignAdmin={canAssignAdmin}
            canKick={canKick}
            canModerate={canModerate}
            key={peer.id}
            onAdmin={setAdminPeer}
            onKick={() => setKickPeer(peer)}
            onPermissions={setPermissionPeer}
            peer={peer}
          />
        ))}
      </ul>

      {permissionPeer ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <section className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-surface-foreground">
              Participant permissions
            </h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {permissionPeer.displayName}
            </p>
            <div className="mt-4 grid gap-3">
              {[
                ["can_use_mic", "Can use microphone"],
                ["can_use_camera", "Can use camera"],
                ["can_share_screen", "Can share screen"],
                ["can_chat", "Can chat"],
                ["can_react", "Can send reactions"]
              ].map(([key, label]) => (
                <label
                  className="flex items-center justify-between gap-3 text-sm text-foreground"
                  key={key}
                >
                  {label}
                  <input
                    checked={permissionDraft[key as keyof PeerPermissions]}
                    className="size-4"
                    onChange={(event) =>
                      setPermissionDraft((current) => ({
                        ...current,
                        [key]: event.target.checked
                      }))
                    }
                    type="checkbox"
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-md border border-border px-3 py-2 text-sm font-semibold"
                onClick={() => setPermissionPeer(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                onClick={() => {
                  onSetPeerPermissions?.(permissionPeer.id, permissionDraft);
                  setPermissionPeer(null);
                }}
                type="button"
              >
                Save
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {adminPeer ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <section className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-surface-foreground">
              Admin permissions
            </h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {adminPeer.displayName}
            </p>
            <label className="mt-4 flex items-center justify-between gap-3 text-sm font-medium text-foreground">
              Make admin
              <input
                checked={adminEnabled}
                className="size-4"
                onChange={(event) => setAdminEnabled(event.target.checked)}
                type="checkbox"
              />
            </label>
            <div className="mt-4 grid gap-3">
              {[
                ["can_kick", "Can kick participants"],
                ["can_mute_mic", "Can disable microphones"],
                ["can_disable_camera", "Can disable cameras"],
                ["can_disable_screen", "Can disable screen share"],
                ["can_disable_chat", "Can disable chat"],
                ["can_disable_emoji", "Can disable reactions"]
              ].map(([key, label]) => (
                <label
                  className="flex items-center justify-between gap-3 text-sm text-foreground"
                  key={key}
                >
                  {label}
                  <input
                    checked={adminDraft[key as keyof AdminPermissions]}
                    className="size-4"
                    disabled={!adminEnabled}
                    onChange={(event) =>
                      setAdminDraft((current) => ({
                        ...current,
                        [key]: event.target.checked
                      }))
                    }
                    type="checkbox"
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-md border border-border px-3 py-2 text-sm font-semibold"
                onClick={() => setAdminPeer(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                onClick={() => {
                  onSetAdminPermissions?.(
                    adminPeer.id,
                    adminEnabled,
                    adminDraft
                  );
                  setAdminPeer(null);
                }}
                type="button"
              >
                Save
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {kickPeer ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <section className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-surface-foreground">
              Remove participant
            </h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {kickPeer.displayName}
            </p>
            <label className="mt-4 grid gap-1 text-sm font-medium text-foreground">
              Rejoin block time
              <select
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                disabled={banPermanent}
                onChange={(event) => setBanMinutes(Number(event.target.value))}
                value={banMinutes}
              >
                <option value={0}>No block</option>
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={60}>1 hour</option>
                <option value={1440}>1 day</option>
              </select>
            </label>
            <label className="mt-3 flex items-center justify-between gap-3 text-sm text-foreground">
              Block permanently
              <input
                checked={banPermanent}
                className="size-4"
                onChange={(event) => setBanPermanent(event.target.checked)}
                type="checkbox"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-md border border-border px-3 py-2 text-sm font-semibold"
                onClick={() => setKickPeer(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-danger px-3 py-2 text-sm font-semibold text-danger-foreground"
                onClick={() => {
                  onKick(
                    kickPeer.id,
                    "Removed by a moderator.",
                    banMinutes,
                    banPermanent
                  );
                  setKickPeer(null);
                  setBanMinutes(0);
                  setBanPermanent(false);
                }}
                type="button"
              >
                Remove
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </aside>
  );
}
