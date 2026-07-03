"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock,
  LogIn,
  Plus,
  Trash2,
  Users
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { ApiClientError } from "@/lib/api/client";
import { createRoom, getRoom } from "@/features/rooms/api/roomsApi";
import { usePublicSettings } from "@/features/rooms/hooks/useRoomMeta";
import { normalizeRoomIdInput } from "@/features/rooms/lib/roomId";
import {
  listRecentRooms,
  removeRecentRoom,
  type RecentRoom
} from "@/features/rooms/lib/recentRooms";
import { saveHostToken } from "@/lib/storage/tokenStorage";
import { formatUnixSeconds } from "@/lib/utils/formatters";
import { useLocale } from "@/providers/LocaleProvider";

export default function HomePage() {
  const router = useRouter();
  const { data } = usePublicSettings();
  const { t } = useLocale();
  const [roomId, setRoomId] = useState("");
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"join" | "create" | null>(null);
  const normalizedRoomId = normalizeRoomIdInput(roomId);
  const canJoin = normalizedRoomId.length > 0;
  const showLogin = data?.app_mode === "private";

  useEffect(() => {
    setRecentRooms(listRecentRooms());
  }, []);

  function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canJoin) {
      return;
    }

    router.push(`/meet/${normalizedRoomId}`);
  }

  async function handleRecentJoin(room: RecentRoom) {
    setBusyRoomId(room.id);
    setBusyAction("join");
    try {
      await getRoom(room.id);
      router.push(`/meet/${room.id}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        toast.info(t("room.sameIdNewRoom"));
        await handleRecreate(room);
        return;
      }
      toast.error(t("room.statusCheckFailed"));
    } finally {
      setBusyRoomId(null);
      setBusyAction(null);
    }
  }

  async function handleRecreate(room: RecentRoom) {
    setBusyRoomId(room.id);
    setBusyAction("create");
    try {
      const response = await createRoom({
        join_policy: room.joinPolicy,
        max_peers: 50,
        name: room.name,
        room_id: room.id
      });
      saveHostToken(response.room.id, response.host_token);
      router.push(`/meet/${response.room.id}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        router.push(`/meet/${room.id}`);
        return;
      }
      toast.error(t("error.couldNotCreateRoom"));
    } finally {
      setBusyRoomId(null);
      setBusyAction(null);
    }
  }

  function forgetRoom(roomIdToRemove: string) {
    removeRecentRoom(roomIdToRemove);
    setRecentRooms(listRecentRooms());
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-6xl flex-col gap-10 py-8 lg:gap-12 lg:py-12">
      <div className="mx-auto flex w-full flex-col items-center gap-7 text-center">
        <div className="space-y-5">
          <h1 className="meet-landing-title mx-auto max-w-3xl text-4xl font-semibold tracking-normal text-foreground sm:text-5xl lg:text-6xl">
            {t("room.startHeroTitle")}
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground">
            {t("room.startHeroBody")}
          </p>
        </div>
        <div className="flex w-full flex-col gap-4 rounded-lg border border-border bg-surface p-3 text-start shadow-sm sm:p-4 lg:flex-row lg:items-center">
          <Link
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            href="/rooms/new"
          >
            {t("room.createRoom")}
            <ArrowRight className="size-4" />
          </Link>
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:flex-col lg:gap-2">
            <span className="h-px flex-1 bg-border lg:h-8 lg:w-px lg:flex-none" />
            {t("room.or")}
            <span className="h-px flex-1 bg-border lg:h-8 lg:w-px lg:flex-none" />
          </div>
          <form className="flex w-full min-w-0 flex-1 flex-col gap-2" onSubmit={joinRoom}>
            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row">
              <input
                aria-describedby="room-id-flexible-hint"
                aria-label={t("room.meetingId")}
                className="h-14 min-h-14 w-full min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-base font-semibold tracking-normal text-foreground outline-none transition placeholder:text-muted-foreground/75 focus:border-primary sm:h-12 sm:min-h-12 sm:text-sm"
                inputMode="text"
                onChange={(event) => setRoomId(event.target.value)}
                placeholder={t("room.enterMeetingId")}
                value={roomId}
              />
              <button
                className="inline-flex h-14 min-h-14 items-center justify-center rounded-md bg-foreground px-5 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:min-h-12"
                disabled={!canJoin}
                type="submit"
              >
                {t("room.joinRoom")}
              </button>
            </div>
            <p
              className="px-1 text-xs leading-5 text-muted-foreground"
              id="room-id-flexible-hint"
            >
              {t("room.roomIdFlexibleHint")}
            </p>
          </form>
          {showLogin ? (
            <Link
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-background px-5 text-sm font-semibold text-surface-foreground transition hover:bg-muted"
              href="/login"
            >
              <LogIn className="size-4" />
              {t("auth.login")}
            </Link>
          ) : null}
        </div>
      </div>

      <aside className="w-full rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-snug text-surface-foreground">
              {t("room.recentRooms")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("room.recentRoomsDescription")}
            </p>
          </div>
          <Clock className="size-5 shrink-0 text-muted-foreground" />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recentRooms.length ? (
            recentRooms.map((room) => {
              const expired =
                room.expiresAt !== undefined &&
                room.expiresAt <= Math.floor(Date.now() / 1000);
              return (
                <article
                  className="flex min-h-[152px] flex-col justify-between rounded-md border border-border bg-background p-3"
                  key={room.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                        {room.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {room.id}
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" />
                          {room.joinPolicy === "approval"
                            ? t("meeting.hostApproval")
                            : t("common.open")}
                        </span>
                        {room.expiresAt ? (
                          <span>
                            {expired
                              ? t("room.expired")
                              : t("room.expiresAt", {
                                  date: formatUnixSeconds(room.expiresAt)
                                })}
                          </span>
                        ) : (
                          <span>{t("room.noExpiry")}</span>
                        )}
                      </p>
                    </div>
                    <button
                      aria-label={t("room.forgetRoom", { name: room.name })}
                      className="grid size-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      onClick={() => forgetRoom(room.id)}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-foreground px-3 text-xs font-semibold text-background transition hover:bg-foreground/90 disabled:opacity-50"
                      disabled={busyRoomId === room.id}
                      onClick={() => void handleRecentJoin(room)}
                      type="button"
                    >
                      {busyRoomId === room.id && busyAction === "join" ? (
                        <LoadingSpinner label={t("room.openingRoom")} size="sm" />
                      ) : null}
                      {t("room.join")}
                    </button>
                    {expired ? (
                      <button
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
                        disabled={busyRoomId === room.id}
                        onClick={() => void handleRecreate(room)}
                        type="button"
                      >
                        {busyRoomId === room.id && busyAction === "create" ? (
                          <LoadingSpinner label={t("room.creatingRoom")} size="sm" />
                        ) : (
                          <Plus className="size-3.5" />
                        )}
                        {t("room.newWithId")}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              {t("room.joinedRoomsAppear")}
            </p>
          )}
        </div>
      </aside>
    </section>
  );
}
