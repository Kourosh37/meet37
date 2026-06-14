"use client";

import {
  Activity,
  BarChart3,
  Camera,
  Cpu,
  HardDrive,
  Mic,
  MonitorUp,
  Server,
  Shield,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { InlineError } from "@/components/feedback/InlineError";
import { AppModeToggle } from "@/features/admin/components/AppModeToggle";
import { CreateUserModal } from "@/features/admin/components/CreateUserModal";
import { UserTable } from "@/features/admin/components/UserTable";
import { useAdminSettings } from "@/features/admin/hooks/useAdminSettings";
import {
  useAdminAnalytics,
  useAdminRoomDetail,
  useAdminRooms,
  useAdminServerStatus
} from "@/features/admin/hooks/useAdminRooms";
import { useAdminUsers } from "@/features/admin/hooks/useAdminUsers";
import { formatBytes } from "@/lib/utils/formatters";
import { useLocale } from "@/providers/LocaleProvider";
import type {
  AdminAnalyticsRange,
  AdminAnalyticsSeries,
  AdminServerResource,
  LiveRoomPeerDetail
} from "@/types/api";

const ranges = [
  { key: "today", labelKey: "admin.today" },
  { key: "7d", labelKey: "admin.last7Days" },
  { key: "30d", labelKey: "admin.last30Days" }
] as const satisfies Array<{
  key: AdminAnalyticsRange;
  labelKey: "admin.today" | "admin.last7Days" | "admin.last30Days";
}>;

const tabs = [
  { key: "overview", labelKey: "admin.dashboard", icon: BarChart3 },
  { key: "rooms", labelKey: "admin.liveRooms", icon: Activity },
  { key: "server", labelKey: "admin.server", icon: Server },
  { key: "access", labelKey: "admin.access", icon: Shield },
  { key: "users", labelKey: "admin.users", icon: Users }
] as const;

type AdminTab = (typeof tabs)[number]["key"];

export default function AdminDashboardPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [range, setRange] = useState<AdminAnalyticsRange>("7d");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const analytics = useAdminAnalytics(range);
  const rooms = useAdminRooms();
  const serverStatus = useAdminServerStatus();
  const selectedRoom = useAdminRoomDetail(selectedRoomId);
  const settings = useAdminSettings();
  const users = useAdminUsers();

  useEffect(() => {
    if (!selectedRoomId && rooms.rooms[0]) {
      setSelectedRoomId(rooms.rooms[0].room.id);
    }
    if (
      selectedRoomId &&
      !rooms.rooms.some(({ room }) => room.id === selectedRoomId)
    ) {
      setSelectedRoomId(rooms.rooms[0]?.room.id ?? null);
    }
  }, [rooms.rooms, selectedRoomId]);

  const selectedRoomName = useMemo(
    () =>
      rooms.rooms.find(({ room }) => room.id === selectedRoomId)?.room.name ??
      selectedRoomId,
    [rooms.rooms, selectedRoomId]
  );

  return (
    <section className="space-y-6 pt-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">
            {t("common.admin")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">
            {t("admin.dashboard")}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {t("admin.dashboardDescription")}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-surface p-1 shadow-sm">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;

            return (
              <button
                className={
                  active
                    ? "inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                    : "inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                }
                key={item.key}
                onClick={() => setTab(item.key)}
                type="button"
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="inline-flex rounded-lg border border-border bg-surface p-1 shadow-sm">
            {ranges.map((item) => (
              <button
                className={
                  range === item.key
                    ? "min-h-9 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                    : "min-h-9 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                }
                key={item.key}
                onClick={() => setRange(item.key)}
                type="button"
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>
          <InlineError
            message={analytics.error ? t("error.couldNotLoadRooms") : null}
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <AnalyticsCard
              colorClass="bg-primary"
              icon={<Users className="size-5" />}
              isLoading={analytics.isLoading}
              series={analytics.data?.users}
              title={t("admin.totalUsers")}
            />
            <AnalyticsCard
              colorClass="bg-success"
              icon={<Activity className="size-5" />}
              isLoading={analytics.isLoading}
              series={analytics.data?.rooms}
              title={t("admin.roomsCreated")}
            />
          </div>
        </div>
      ) : null}

      {tab === "rooms" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.2fr)]">
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-surface-foreground">
                {t("admin.liveRooms")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("admin.liveRoomsDescription")}
              </p>
            </div>
            <InlineError
              className="m-4"
              message={rooms.error ? t("error.couldNotLoadRoomStats") : null}
            />
            {rooms.rooms.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                {rooms.isLoading ? t("common.loading") : t("admin.noLiveRooms")}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {rooms.rooms.map(({ room, stats }) => {
                  const active = room.id === selectedRoomId;

                  return (
                    <button
                      className={
                        active
                          ? "block w-full bg-primary/10 px-5 py-4 text-start"
                          : "block w-full px-5 py-4 text-start transition hover:bg-muted"
                      }
                      key={room.id}
                      onClick={() => setSelectedRoomId(room.id)}
                      type="button"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-surface-foreground">
                            {room.name}
                          </span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {room.id}
                          </span>
                        </span>
                        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
                          {stats?.peer_count ?? 0} {t("admin.peers")}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-surface-foreground">
                  {t("admin.roomDetail")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedRoomName ?? t("admin.selectRoom")}
                </p>
              </div>
              {selectedRoom.data ? (
                <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                  {selectedRoom.data.peer_count} {t("admin.activeUsers")}
                </span>
              ) : null}
            </div>
            {!selectedRoomId ? (
              <p className="py-8 text-sm text-muted-foreground">
                {t("admin.selectRoom")}
              </p>
            ) : (
              <RoomDetailPanel
                isLoading={selectedRoom.isLoading}
                peers={selectedRoom.data?.peers ?? []}
                resources={selectedRoom.data?.resources}
              />
            )}
          </div>
        </div>
      ) : null}

      {tab === "server" ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("admin.liveServerStatus")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {serverStatus.data
                ? t("admin.createdAt", {
                    date: new Date(
                      serverStatus.data.collected_at * 1000
                    ).toLocaleTimeString()
                  })
                : t("common.loading")}
            </p>
          </div>
          <InlineError
            message={serverStatus.error ? t("error.couldNotLoadRoomStats") : null}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <MetricCard
              detail={`${serverStatus.data?.cpu.cores ?? 0} cores`}
              icon={<Cpu className="size-5" />}
              label={t("admin.cpu")}
              percent={serverStatus.data?.cpu.percent ?? 0}
              value={`${serverStatus.data?.cpu.percent ?? 0}%`}
            />
            <ResourceCard
              icon={<Server className="size-5" />}
              label={t("admin.memory")}
              resource={serverStatus.data?.memory}
            />
            <ResourceCard
              icon={<HardDrive className="size-5" />}
              label={t("admin.storage")}
              resource={serverStatus.data?.disk}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SmallStat
              label={t("admin.heap")}
              value={formatBytes(serverStatus.data?.runtime.heap_alloc_bytes ?? 0)}
            />
            <SmallStat
              label={t("admin.goroutines")}
              value={String(serverStatus.data?.runtime.goroutines ?? 0)}
            />
          </div>
        </div>
      ) : null}

      {tab === "access" ? (
        <AppModeToggle
          appMode={settings.appMode}
          disabled={settings.isLoading || settings.isUpdating}
          onChange={settings.setAppMode}
        />
      ) : null}

      {tab === "users" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t("admin.users")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("admin.usersDescription")}
              </p>
            </div>
            <CreateUserModal
              disabled={users.isMutating}
              onCreate={users.createUser}
            />
          </div>
          <InlineError
            message={users.error ? t("error.couldNotLoadRooms") : null}
          />
          <UserTable
            disabled={users.isMutating}
            onDelete={users.deleteUser}
            onUpdate={(userId, request) =>
              users.updateUser({ request, userId })
            }
            users={users.users}
          />
        </div>
      ) : null}
    </section>
  );
}

function AnalyticsCard({
  colorClass,
  icon,
  isLoading,
  series,
  title
}: {
  colorClass: string;
  icon: ReactNode;
  isLoading: boolean;
  series?: AdminAnalyticsSeries;
  title: string;
}) {
  const max = Math.max(1, ...(series?.series.map((point) => point.count) ?? []));

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-normal text-surface-foreground">
            {isLoading ? "..." : series?.total ?? 0}
          </p>
        </div>
        <div className="grid size-11 place-items-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
      <div className="mt-6 flex h-44 items-end gap-1.5 overflow-hidden">
        {(series?.series ?? []).map((point) => {
          const height = point.count > 0 ? Math.max(8, (point.count / max) * 100) : 2;

          return (
            <div
              className="flex min-w-6 flex-1 flex-col items-center justify-end gap-2"
              key={`${point.start}-${point.end}`}
            >
              <div
                className={`${colorClass} w-full rounded-t-sm opacity-85`}
                style={{ height: `${height}%` }}
                title={`${point.label}: ${point.count}`}
              />
              <span className="max-w-12 truncate text-[10px] text-muted-foreground">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoomDetailPanel({
  isLoading,
  peers,
  resources
}: {
  isLoading: boolean;
  peers: LiveRoomPeerDetail[];
  resources?: {
    estimated_cpu_percent: number;
    estimated_memory_bytes: number;
    share_of_active_peers: number;
  };
}) {
  const { t } = useLocale();

  if (isLoading && peers.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-5 pt-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <SmallStat
          label={t("admin.estimatedCpu")}
          value={`${resources?.estimated_cpu_percent ?? 0}%`}
        />
        <SmallStat
          label={t("admin.estimatedMemory")}
          value={formatBytes(resources?.estimated_memory_bytes ?? 0)}
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-start text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("admin.username")}</th>
              <th className="px-4 py-3">{t("admin.mode")}</th>
              <th className="px-4 py-3">{t("meeting.microphone")}</th>
              <th className="px-4 py-3">{t("meeting.camera")}</th>
              <th className="px-4 py-3">{t("admin.screenShare")}</th>
            </tr>
          </thead>
          <tbody>
            {peers.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-muted-foreground" colSpan={5}>
                  {t("admin.noLiveRooms")}
                </td>
              </tr>
            ) : (
              peers.map((peer) => (
                <tr className="border-t border-border" key={peer.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-surface-foreground">
                      {peer.display_name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {peer.is_host ? t("common.host") : peer.is_admin ? t("common.admin") : peer.id.slice(0, 8)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {peer.mode.toUpperCase()}
                  </td>
                  <td className="px-4 py-3">
                    <MediaState
                      enabled={peer.audio_enabled}
                      icon={<Mic className="size-3.5" />}
                      status={peer.audio_status}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <MediaState
                      enabled={peer.video_enabled}
                      icon={<Camera className="size-3.5" />}
                      status={peer.video_status}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <MediaState
                      enabled={peer.screen_sharing}
                      icon={<MonitorUp className="size-3.5" />}
                      status={peer.screen_share_status}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MediaState({
  enabled,
  icon,
  status
}: {
  enabled: boolean;
  icon: ReactNode;
  status: string;
}) {
  const tone =
    status === "error"
      ? "border-danger/30 bg-danger/10 text-danger"
      : enabled
        ? "border-success/30 bg-success/10 text-success"
        : "border-border bg-background text-muted-foreground";

  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${tone}`}
    >
      {icon}
      {status}
    </span>
  );
}

function MetricCard({
  detail,
  icon,
  label,
  percent,
  value
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  percent: number;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          {detail}
        </span>
      </div>
      <p className="mt-5 text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal text-surface-foreground">
        {value}
      </p>
      <ProgressBar value={percent} />
    </div>
  );
}

function ResourceCard({
  icon,
  label,
  resource
}: {
  icon: ReactNode;
  label: string;
  resource?: AdminServerResource;
}) {
  const { t } = useLocale();

  return (
    <MetricCard
      detail={`${t("admin.free")} ${formatBytes(resource?.free_bytes ?? 0)}`}
      icon={icon}
      label={label}
      percent={resource?.percent ?? 0}
      value={`${formatBytes(resource?.used_bytes ?? 0)} / ${formatBytes(resource?.total_bytes ?? 0)}`}
    />
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-normal text-surface-foreground">
        {value}
      </p>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
