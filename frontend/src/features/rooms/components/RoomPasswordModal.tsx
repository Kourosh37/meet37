"use client";

import { FormEvent, useEffect, useState } from "react";
import { Lock, X } from "lucide-react";
import { InlineError } from "@/components/feedback/InlineError";

interface RoomPasswordModalProps {
  error?: string | null;
  isOpen: boolean;
  onCancel: () => void;
  onSubmit: (password: string) => void;
  roomName?: string;
}

export function RoomPasswordModal({
  error,
  isOpen,
  onCancel,
  onSubmit,
  roomName
}: RoomPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setSubmitted(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!password.trim()) {
      return;
    }

    onSubmit(password);
  }

  const validationError =
    submitted && !password.trim() ? "Room password is required." : null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4"
      role="dialog"
    >
      <form
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-xl"
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
              <Lock className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-surface-foreground">
                Room password
              </h2>
              {roomName ? (
                <p className="mt-1 text-xs text-muted-foreground">{roomName}</p>
              ) : null}
            </div>
          </div>
          <button
            aria-label="Close password prompt"
            className="grid size-8 place-items-center rounded-md border border-border text-foreground transition hover:bg-muted"
            onClick={onCancel}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <label
          className="mt-5 block text-sm font-medium text-surface-foreground"
          htmlFor="room-password-modal-input"
        >
          Password
        </label>
        <input
          autoComplete="off"
          autoFocus
          className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          id="room-password-modal-input"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />

        <InlineError className="mt-3" message={validationError ?? error} />

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            type="submit"
          >
            Join
          </button>
        </div>
      </form>
    </div>
  );
}
