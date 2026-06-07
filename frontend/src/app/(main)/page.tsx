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
  Users,
  Video
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { ApiClientError } from "@/lib/api/client";
import { createRoom, getRoom } from "@/features/rooms/api/roomsApi";
import { usePublicSettings } from "@/features/rooms/hooks/useRoomMeta";
import {
  listRecentRooms,
  removeRecentRoom,
  type RecentRoom
} from "@/features/rooms/lib/recentRooms";
import { formatUnixSeconds } from "@/lib/utils/formatters";

export default function HomePage() {
  const router = useRouter();
  const { data } = usePublicSettings();
  const [roomId, setRoomId] = useState("");
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"join" | "create" | null>(null);
  const normalizedRoomId = roomId.trim().toLowerCase();
  const canJoin = /^[a-z]{3}-[a-z]{3}-[a-z]{3}$/.test(normalizedRoomId);
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
        toast.info("Starting a new room with the same meeting ID");
        await handleRecreate(room);
        return;
      }
      toast.error("Could not check room status");
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
      router.push(`/meet/${response.room.id}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        router.push(`/meet/${room.id}`);
        return;
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create room with this meeting ID"
      );
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
    <section className="mx-auto grid min-h-[calc(100vh-12rem)] max-w-6xl gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center lg:py-12">
      <div className="space-y-7">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground shadow-sm">
          <Video className="size-4 text-primary" />
          Browser meetings
        </div>
        <div className="space-y-5">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-foreground sm:text-5xl lg:text-6xl">
            Start a meeting and share the link.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Create a room in seconds, enter with a display name, and keep the
            meeting controls focused on the call.
          </p>
        </div>
        <div className="flex w-full max-w-3xl flex-col gap-4 rounded-lg border border-border bg-surface p-3 shadow-sm sm:p-4 lg:flex-row lg:items-center">
          <Link
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            href="/rooms/new"
          >
            Create room
            <ArrowRight className="size-4" />
          </Link>
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:flex-col lg:gap-2">
            <span className="h-px flex-1 bg-border lg:h-8 lg:w-px lg:flex-none" />
            OR
            <span className="h-px flex-1 bg-border lg:h-8 lg:w-px lg:flex-none" />
          </div>
          <form
            className="flex w-full min-w-0 flex-1 flex-col gap-2 sm:flex-row"
            onSubmit={joinRoom}
          >
            <input
              className="h-14 min-h-14 w-full min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-base font-semibold lowercase tracking-normal text-foreground outline-none transition placeholder:text-muted-foreground/75 focus:border-primary sm:h-12 sm:min-h-12 sm:text-sm"
              inputMode="text"
              aria-label="Meeting ID"
              onChange={(event) => setRoomId(event.target.value)}
              pattern="[A-Za-z]{3}-[A-Za-z]{3}-[A-Za-z]{3}"
              placeholder="Enter meeting ID, like abc-def-ghi"
              value={roomId}
            />
            <button
              className="inline-flex h-14 min-h-14 items-center justify-center rounded-md bg-foreground px-5 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:min-h-12"
              disabled={!canJoin}
              type="submit"
            >
              Join room
            </button>
          </form>
          {showLogin ? (
            <Link
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-background px-5 text-sm font-semibold text-surface-foreground transition hover:bg-muted"
              href="/login"
            >
              <LogIn className="size-4" />
              Login
            </Link>
          ) : null}
        </div>
      </div>

      <aside className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-surface-foreground">
              Recent rooms
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your last 7 joined meeting IDs are saved on this device.
            </p>
          </div>
          <Clock className="size-5 shrink-0 text-muted-foreground" />
        </div>

        <div className="mt-4 grid gap-2">
          {recentRooms.length ? (
            recentRooms.map((room) => {
              const expired =
                room.expiresAt !== undefined &&
                room.expiresAt <= Math.floor(Date.now() / 1000);
              return (
                <article
                  className="rounded-md border border-border bg-background p-3"
                  key={room.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {room.name}
                      </h3>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {room.id}
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" />
                          {room.joinPolicy === "approval" ? "Approval" : "Open"}
                        </span>
                        {room.expiresAt ? (
                          <span>
                            {expired
                              ? "Expired"
                              : `Expires ${formatUnixSeconds(room.expiresAt)}`}
                          </span>
                        ) : (
                          <span>No expiry</span>
                        )}
                      </p>
                    </div>
                    <button
                      aria-label={`Forget ${room.name}`}
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
                        <LoadingSpinner label="Opening room" size="sm" />
                      ) : null}
                      Join
                    </button>
                    {expired ? (
                      <button
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
                        disabled={busyRoomId === room.id}
                        onClick={() => void handleRecreate(room)}
                        type="button"
                      >
                        {busyRoomId === room.id && busyAction === "create" ? (
                          <LoadingSpinner label="Creating room" size="sm" />
                        ) : (
                          <Plus className="size-3.5" />
                        )}
                        New with ID
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Joined rooms will appear here after your first meeting.
            </p>
          )}
        </div>
      </aside>
    </section>
  );
}
