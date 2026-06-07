"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LogIn, Video } from "lucide-react";
import Link from "next/link";
import { usePublicSettings } from "@/features/rooms/hooks/useRoomMeta";

export default function HomePage() {
  const router = useRouter();
  const { data } = usePublicSettings();
  const [roomId, setRoomId] = useState("");
  const normalizedRoomId = roomId.trim().toLowerCase();
  const canJoin = /^[a-z]{3}-[a-z]{3}-[a-z]{3}$/.test(normalizedRoomId);
  const showLogin = data?.app_mode === "private";

  function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canJoin) {
      return;
    }

    router.push(`/meet/${normalizedRoomId}`);
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-4xl flex-col justify-center py-10">
      <div className="space-y-7">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground">
          <Video className="size-4 text-primary" />
          Browser meetings
        </div>
        <div className="space-y-5">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-foreground sm:text-6xl">
            Start a meeting and share the link.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Create a room in seconds, enter with a display name, and keep the
            meeting controls focused on the call.
          </p>
        </div>
        <div className="flex w-full max-w-3xl flex-col gap-3 lg:flex-row">
          <Link
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            href="/rooms/new"
          >
            Create room
            <ArrowRight className="size-4" />
          </Link>
          <form
            className="flex w-full min-w-0 flex-1 flex-col gap-2 sm:flex-row"
            onSubmit={joinRoom}
          >
            <input
              className="h-14 min-h-14 w-full min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-base font-semibold lowercase tracking-normal text-foreground outline-none transition focus:border-primary sm:h-12 sm:min-h-12 sm:text-sm"
              inputMode="text"
              onChange={(event) => setRoomId(event.target.value)}
              pattern="[A-Za-z]{3}-[A-Za-z]{3}-[A-Za-z]{3}"
              placeholder="aaa-aaa-aaa"
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
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-surface px-5 text-sm font-semibold text-surface-foreground transition hover:bg-muted"
              href="/login"
            >
              <LogIn className="size-4" />
              Login
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
