"use client";

import { useEffect } from "react";
import { Camera, CameraOff, LogOut, Mic, MicOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { VideoGrid } from "@/features/meeting/components/VideoGrid";
import { useLocalMedia } from "@/features/meeting/hooks/useLocalMedia";
import { usePeerConnections } from "@/features/meeting/hooks/usePeerConnections";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import { useWebSocket } from "@/features/meeting/hooks/useWebSocket";

interface MeetingRoomProps {
  displayName: string;
  roomName?: string;
}

export function MeetingRoom({ displayName, roomName }: MeetingRoomProps) {
  const router = useRouter();
  const meeting = useMeetingStore();
  const websocket = useWebSocket();
  const localMedia = useLocalMedia();
  const startLocalMedia = localMedia.start;
  const stopLocalMedia = localMedia.stop;
  const { remoteStreams } = usePeerConnections(localMedia.stream);

  useEffect(() => {
    void startLocalMedia();

    return () => {
      stopLocalMedia();
    };
  }, [startLocalMedia, stopLocalMedia]);

  function handleLeave() {
    stopLocalMedia();
    websocket.close();
    meeting.reset();
    router.push("/");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {websocket.status === "open" ? "Connected" : websocket.status}
          </p>
          <h1 className="truncate text-lg font-semibold tracking-normal text-surface-foreground">
            {roomName ?? "Meeting room"}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{Object.keys(meeting.peers).length + 1} participants</span>
        </div>
      </header>

      {localMedia.error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {localMedia.error}
        </div>
      ) : null}

      <VideoGrid
        local={{
          audioEnabled: localMedia.audioEnabled,
          displayName,
          isHost: meeting.isHost,
          screenSharing: localMedia.screenSharing,
          stream: localMedia.stream,
          videoEnabled: localMedia.videoEnabled
        }}
        peers={meeting.peers}
        remoteStreams={remoteStreams}
      />

      <footer className="sticky bottom-4 z-10 mx-auto flex w-fit max-w-full items-center gap-2 rounded-lg border border-border bg-surface/95 p-2 shadow-lg backdrop-blur">
        <button
          aria-label={
            localMedia.audioEnabled ? "Mute microphone" : "Unmute microphone"
          }
          className="grid size-11 place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted"
          onClick={localMedia.toggleAudio}
          title={
            localMedia.audioEnabled ? "Mute microphone" : "Unmute microphone"
          }
          type="button"
        >
          {localMedia.audioEnabled ? (
            <Mic className="size-5" />
          ) : (
            <MicOff className="size-5" />
          )}
        </button>
        <button
          aria-label={
            localMedia.videoEnabled ? "Turn camera off" : "Turn camera on"
          }
          className="grid size-11 place-items-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted"
          onClick={localMedia.toggleVideo}
          title={localMedia.videoEnabled ? "Turn camera off" : "Turn camera on"}
          type="button"
        >
          {localMedia.videoEnabled ? (
            <Camera className="size-5" />
          ) : (
            <CameraOff className="size-5" />
          )}
        </button>
        <button
          aria-label="Leave meeting"
          className="grid size-11 place-items-center rounded-md bg-danger text-danger-foreground transition hover:bg-danger/90"
          onClick={handleLeave}
          title="Leave meeting"
          type="button"
        >
          <LogOut className="size-5" />
        </button>
      </footer>
    </main>
  );
}

export default MeetingRoom;
