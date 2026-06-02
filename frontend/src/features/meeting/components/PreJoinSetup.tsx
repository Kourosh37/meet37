"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/layout/BrandMark";
import { MeetingRoom } from "@/features/meeting/components/MeetingRoom";
import { WaitingRoom } from "@/features/meeting/components/WaitingRoom";
import { useMeetingRoom } from "@/features/meeting/hooks/useMeetingRoom";
import { DeviceSetup } from "@/features/prejoin/components/DeviceSetup";
import { DisplayNameInput } from "@/features/prejoin/components/DisplayNameInput";
import { PasswordPrompt } from "@/features/prejoin/components/PasswordPrompt";
import { useRoomMeta } from "@/features/rooms/hooks/useRoomMeta";
import { displayNameSchema } from "@/lib/utils/validators";
import Link from "next/link";

const DISPLAY_NAME_KEY = "meet_display_name";
const JOIN_TOAST_ID = "meeting-join-status";

export function PreJoinSetup({ roomId }: { roomId: string }) {
  const { data, error, isLoading } = useRoomMeta(roomId);
  const { cancelJoin, joinMeeting, meeting, websocket } =
    useMeetingRoom(roomId);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const hasShownWaitingToastRef = useRef(false);
  const hasShownJoinedToastRef = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(DISPLAY_NAME_KEY);

    if (stored) {
      setDisplayName(stored);
    }
  }, []);

  const displayNameResult = useMemo(
    () => displayNameSchema.safeParse(displayName),
    [displayName]
  );
  const displayNameError =
    submitted && !displayNameResult.success
      ? displayNameResult.error.issues[0]?.message
      : undefined;

  function handleJoin() {
    setSubmitted(true);

    if (!displayNameResult.success) {
      return;
    }

    window.localStorage.setItem(DISPLAY_NAME_KEY, displayNameResult.data);
    const { joinedAsHost } = joinMeeting({
      displayName: displayNameResult.data,
      password
    });
    hasShownWaitingToastRef.current = false;
    hasShownJoinedToastRef.current = false;
    toast.loading("Joining room", {
      description: joinedAsHost
        ? "Joining as room host."
        : "Checking room access.",
      id: JOIN_TOAST_ID
    });
  }

  useEffect(() => {
    if (meeting.phase !== "idle" || !meeting.error) {
      return;
    }

    toast.error("Could not join room", {
      description: meeting.error,
      id: JOIN_TOAST_ID
    });
  }, [meeting.error, meeting.phase]);

  useEffect(() => {
    if (
      meeting.phase !== "waiting-approval" ||
      hasShownWaitingToastRef.current
    ) {
      return;
    }

    hasShownWaitingToastRef.current = true;
    toast.info("Waiting for host approval", {
      description: "The host has been notified.",
      id: JOIN_TOAST_ID
    });
  }, [meeting.phase]);

  useEffect(() => {
    if (meeting.phase !== "in-call" || hasShownJoinedToastRef.current) {
      return;
    }

    hasShownJoinedToastRef.current = true;
    toast.success("Joined room", {
      description: "Media and signaling are ready.",
      id: JOIN_TOAST_ID
    });
  }, [meeting.phase]);

  useEffect(() => {
    if (["kicked", "rejected", "room-closed"].includes(meeting.phase)) {
      toast.dismiss(JOIN_TOAST_ID);
    }
  }, [meeting.phase]);

  if (meeting.phase === "waiting-approval") {
    return <WaitingRoom onCancel={cancelJoin} roomName={data?.room.name} />;
  }

  if (meeting.phase === "in-call") {
    return (
      <MeetingRoom
        displayName={
          displayNameResult.success ? displayNameResult.data : displayName
        }
        roomName={data?.room.name}
      />
    );
  }

  if (["kicked", "rejected", "room-closed"].includes(meeting.phase)) {
    return (
      <section className="mx-auto max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-normal text-surface-foreground">
          {meeting.phase === "room-closed" ? "Meeting ended" : "Unable to join"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {meeting.error ??
            (meeting.phase === "room-closed"
              ? "This room has been closed by the host."
              : "Your meeting session is no longer active.")}
        </p>
        <button
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          onClick={cancelJoin}
          type="button"
        >
          Back to prejoin
        </button>
      </section>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_380px]">
        <div className="aspect-video animate-pulse rounded-lg border border-border bg-muted" />
        <div className="h-96 animate-pulse rounded-lg border border-border bg-muted" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <section className="mx-auto max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <BrandMark className="h-12 w-12" size={48} />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal text-surface-foreground">
          Room unavailable
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This meeting link is invalid or the room has expired.
        </p>
        <Link
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          href="/"
        >
          Back home
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
      <DeviceSetup />

      <aside className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <BrandMark className="h-9 w-9" size={36} />
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {data.room.join_policy === "approval"
              ? "Host approval required"
              : "Open meeting"}
          </p>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-surface-foreground">
          {data.room.name}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {data.live.peer_count} participant
          {data.live.peer_count === 1 ? "" : "s"} in call.
          {data.room.join_policy === "approval"
            ? " The host will need to let you in."
            : " You can join as soon as signaling is connected."}
        </p>

        <div className="mt-6 grid gap-4">
          <DisplayNameInput
            error={displayNameError}
            onChange={setDisplayName}
            value={displayName}
          />
          {data.room.has_password ? (
            <PasswordPrompt onChange={setPassword} value={password} />
          ) : null}
          <button
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              meeting.phase === "joining" || websocket.status === "connecting"
            }
            onClick={handleJoin}
            type="button"
          >
            {meeting.phase === "joining" || websocket.status === "connecting"
              ? "Joining..."
              : "Continue"}
          </button>
          {meeting.error ? (
            <p className="text-sm text-danger">{meeting.error}</p>
          ) : null}
        </div>
      </aside>
    </section>
  );
}
