/*
Frontend architecture note

File: src\features\meeting\components\PreJoinSetup.tsx
Layer: Meeting Runtime

Responsibility:
- Pre-join device and identity screen where users set display name, preview camera/mic, enter optional room password, and start the WebSocket join flow.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: WebSocket signaling endpoint described in backend/docs/WEBSOCKET.md plus room metadata from GET /api/rooms/{id}. The join payload must include display_name and may include password and host_token.

State model to plan: idle, prejoining, waiting-approval, joining, in-call, reconnecting, sfu-active, kicked, rejected, room-closed, media-error, and left.

UX and edge cases to plan:
- Display clear loading and empty states instead of rendering nothing once implementation starts.
- Normalize backend errors into user-safe messages while preserving technical details for logger.ts.
- Keep room links shareable; never require global login just to open an existing meeting link.
- In private app mode, require login only for room creation, not for joining a shared room link.
- Every meeting participant must provide a non-empty display name before joining.

Security and privacy notes:
- Never expose refresh tokens to arbitrary components; use the storage/auth layer only.
- Treat host_token as room-scoped moderation authority and avoid leaking it into URLs or logs.
- Do not persist raw media streams, SDP blobs, ICE candidates, or file bytes unless a later backend feature explicitly requires it.

Future tests: WebSocket join flow, approval room flow, host approve/reject, kick/mute messages, P2P signaling, SFU switch handling, chat/file events, and cleanup on leave.

*/

"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MeetingRoom } from "@/features/meeting/components/MeetingRoom";
import { WaitingRoom } from "@/features/meeting/components/WaitingRoom";
import { useSignalingMessages } from "@/features/meeting/hooks/useSignalingMessages";
import { useWebSocket } from "@/features/meeting/hooks/useWebSocket";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import { DeviceSetup } from "@/features/prejoin/components/DeviceSetup";
import { DisplayNameInput } from "@/features/prejoin/components/DisplayNameInput";
import { PasswordPrompt } from "@/features/prejoin/components/PasswordPrompt";
import { useRoomMeta } from "@/features/rooms/hooks/useRoomMeta";
import { getHostToken } from "@/lib/storage/tokenStorage";
import { displayNameSchema } from "@/lib/utils/validators";
import Link from "next/link";

const DISPLAY_NAME_KEY = "meet_display_name";

export function PreJoinSetup({ roomId }: { roomId: string }) {
  const { data, error, isLoading } = useRoomMeta(roomId);
  const meeting = useMeetingStore();
  const websocket = useWebSocket();
  useSignalingMessages();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

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
    const hostToken = getHostToken(roomId);

    meeting.beginJoin(roomId);
    websocket.connect();
    websocket.send({
      payload: {
        display_name: displayNameResult.data,
        host_token: hostToken ?? undefined,
        password: password || undefined,
        room_id: roomId
      },
      type: "join"
    });
    toast.info("Joining meeting", {
      description: hostToken ? "Joining as room host." : undefined
    });
  }

  if (meeting.phase === "waiting-approval") {
    return (
      <WaitingRoom
        onCancel={() => {
          websocket.close();
          meeting.reset();
        }}
        roomName={data?.room.name}
      />
    );
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
          onClick={() => {
            websocket.close();
            meeting.reset();
          }}
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
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {data.room.join_policy === "approval"
            ? "Host approval required"
            : "Open meeting"}
        </p>
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
