"use client";

import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";

interface WaitingRoomProps {
  onCancel: () => void;
  roomName?: string;
}

export function WaitingRoom({ onCancel, roomName }: WaitingRoomProps) {
  return (
    <section className="mx-auto max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Waiting room
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-normal text-surface-foreground">
        Waiting for approval
      </h1>
      <LoadingSpinner
        className="mt-5 text-primary"
        label="Waiting for approval"
        size="lg"
      />
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Your request to join {roomName ?? "this meeting"} has been sent. The
        host will let you in when they are ready.
      </p>
      <button
        className="mt-6 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
        onClick={onCancel}
        type="button"
      >
        Cancel
      </button>
    </section>
  );
}
