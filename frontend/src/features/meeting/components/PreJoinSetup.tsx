"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { InlineError } from "@/components/feedback/InlineError";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { ConnectionQualityIndicator } from "@/features/meeting/components/ConnectionQualityIndicator";
import { MeetingHeader } from "@/features/meeting/components/MeetingHeader";
import { MeetingRoom } from "@/features/meeting/components/MeetingRoom";
import { WaitingRoom } from "@/features/meeting/components/WaitingRoom";
import { useMeetingRoom } from "@/features/meeting/hooks/useMeetingRoom";
import { useWebSocketPing } from "@/features/meeting/hooks/useWebSocketPing";
import { DeviceSetup } from "@/features/prejoin/components/DeviceSetup";
import { DisplayNameInput } from "@/features/prejoin/components/DisplayNameInput";
import { PasswordPrompt } from "@/features/prejoin/components/PasswordPrompt";
import { saveRecentRoom } from "@/features/rooms/lib/recentRooms";
import { useRoomMeta } from "@/features/rooms/hooks/useRoomMeta";
import { isMessageKey } from "@/lib/i18n/messages";
import { displayNameSchema } from "@/lib/utils/validators";
import { useLocale } from "@/providers/LocaleProvider";
import { Home } from "lucide-react";
import Link from "next/link";

const DISPLAY_NAME_KEY = "meet_display_name";
const JOIN_TOAST_ID = "meeting-join-status";

export function PreJoinSetup({ roomId }: { roomId: string }) {
  const { data, error, isLoading } = useRoomMeta(roomId);
  const { cancelJoin, joinMeeting, meeting, websocket } =
    useMeetingRoom(roomId);
  const { close: closeWebSocket, connect: connectWebSocket } = websocket;
  const { t } = useLocale();
  const pingMs = useWebSocketPing(websocket.status === "open");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const hasShownWaitingToastRef = useRef(false);
  const hasShownJoinedToastRef = useRef(false);
  const meetingPhaseRef = useRef(meeting.phase);

  const meetingErrorMessage =
    meeting.error && isMessageKey(meeting.error) ? t(meeting.error) : meeting.error;

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
      ? t("validation.displayNameRequired")
      : undefined;
  const prejoinConnectionLabel =
    websocket.status !== "open" || pingMs === null
      ? t("connection.pending")
      : pingMs <= 120
        ? t("connection.good")
        : pingMs <= 250
          ? t("connection.unstable")
          : t("connection.poor");
  const prejoinStatusLabel =
    websocket.status === "open"
      ? t("common.ready")
      : websocket.status === "reconnecting"
        ? t("common.reconnecting")
        : t("connection.pending");

  useEffect(() => {
    meetingPhaseRef.current = meeting.phase;
  }, [meeting.phase]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (meetingPhaseRef.current === "idle") {
        closeWebSocket();
      }
    };
  }, [closeWebSocket, connectWebSocket]);

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
    toast.loading(t("meeting.joiningRoom"), {
      description: joinedAsHost
        ? t("meeting.joiningAsHost")
        : t("meeting.joiningAsGuest"),
      id: JOIN_TOAST_ID
    });
  }

  useEffect(() => {
    if (meeting.phase !== "idle" || !meeting.error) {
      return;
    }

    toast.error(t("error.couldNotJoinRoom"), {
      description: meetingErrorMessage,
      id: JOIN_TOAST_ID
    });
  }, [meeting.error, meeting.phase, meetingErrorMessage, t]);

  useEffect(() => {
    if (
      meeting.phase !== "waiting-approval" ||
      hasShownWaitingToastRef.current
    ) {
      return;
    }

    hasShownWaitingToastRef.current = true;
    toast.info(t("meeting.waitingForApproval"), {
      description: t("meeting.waitingHostNotified"),
      id: JOIN_TOAST_ID
    });
  }, [meeting.phase, t]);

  useEffect(() => {
    if (meeting.phase !== "in-call" || hasShownJoinedToastRef.current) {
      return;
    }

    hasShownJoinedToastRef.current = true;
    toast.success(t("meeting.joinedRoom"), {
      description: t("meeting.joinedDescription"),
      id: JOIN_TOAST_ID
    });
    if (data?.room) {
      saveRecentRoom(data.room);
    }
  }, [data?.room, meeting.phase, t]);

  useEffect(() => {
    if (["kicked", "rejected", "room-closed"].includes(meeting.phase)) {
      toast.dismiss(JOIN_TOAST_ID);
    }
  }, [meeting.phase]);

  function renderPrejoinChrome(children: ReactNode) {
    return (
      <>
        <MeetingHeader
          participantCount={data?.live.peer_count}
          roomId={roomId}
          roomName={data?.room.name ?? t("meeting.defaultRoomName")}
        />
        <div className="pt-20">{children}</div>
      </>
    );
  }

  if (meeting.phase === "waiting-approval") {
    return renderPrejoinChrome(
      <WaitingRoom onCancel={cancelJoin} roomName={data?.room.name} />
    );
  }

  if (meeting.phase === "in-call" || meeting.phase === "reconnecting") {
    return (
      <MeetingRoom
        displayName={
          displayNameResult.success ? displayNameResult.data : displayName
        }
        roomJoinPolicy={data?.room.join_policy}
        roomName={data?.room.name}
      />
    );
  }

  if (["kicked", "rejected", "room-closed"].includes(meeting.phase)) {
    return renderPrejoinChrome(
      <section className="mx-auto max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-normal text-surface-foreground">
          {meeting.phase === "room-closed"
            ? t("meeting.ended")
            : t("meeting.unableToJoin")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {meetingErrorMessage ??
              (meeting.phase === "room-closed"
                ? t("meeting.roomClosedBody")
              : t("meeting.sessionInactive"))}
        </p>
        <button
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          onClick={cancelJoin}
          type="button"
        >
          {t("meeting.backToPrejoin")}
        </button>
      </section>
    );
  }

  if (isLoading) {
    return renderPrejoinChrome(
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid aspect-video place-items-center rounded-lg border border-border bg-muted">
          <LoadingSpinner
            className="text-primary"
            label={t("meeting.loadingPreview")}
            size="lg"
          />
        </div>
        <div className="grid h-96 place-items-center rounded-lg border border-border bg-surface">
          <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
            <LoadingSpinner
              className="text-primary"
              label={t("meeting.loadingRoom")}
              size="lg"
            />
            <p className="text-sm font-medium">{t("meeting.loadingRoom")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return renderPrejoinChrome(
      <section className="mx-auto max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-normal text-surface-foreground">
          {t("meeting.roomUnavailable")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("error.roomUnavailable")}
        </p>
        <Link
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          href="/"
        >
          {t("common.backHome")}
        </Link>
      </section>
    );
  }

  return renderPrejoinChrome(
    <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
      <DeviceSetup />

      <aside className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <Link
          className="mb-4 inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-muted"
          href="/"
        >
          <Home className="size-4" />
          {t("common.backHome")}
        </Link>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {data.room.join_policy === "approval"
            ? t("room.hostApproval")
            : t("room.openMeeting")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-surface-foreground">
          {data.room.name}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("meeting.singleParticipantInCall", {
            count: data.live.peer_count
          })}
          {data.room.join_policy === "approval"
            ? t("meeting.hostWillLetYouIn")
            : t("meeting.youCanJoinWhenConnected")}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {prejoinConnectionLabel}
          </span>
          <ConnectionQualityIndicator
            isConnected={websocket.status === "open"}
            pingMs={pingMs}
            quality="unknown"
            statusLabel={prejoinStatusLabel}
          />
        </div>

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
              ? t("common.joining")
              : t("common.continue")}
          </button>
          <InlineError message={meeting.error} />
        </div>
      </aside>
    </section>
  );
}
