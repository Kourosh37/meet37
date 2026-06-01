/*
Frontend architecture note

File: src\features\rooms\components\RoomPasswordModal.tsx
Layer: Rooms

Responsibility:
- Frontend file for the Rooms layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: POST /api/rooms, GET /api/rooms, GET /api/rooms/{id}, DELETE /api/rooms/{id}, GET /api/rooms/{id}/chat, and GET /api/rooms/{id}/files. Public/private app mode changes whether creation requires auth; joining a shared room link remains public.

State model to plan: loading room list, creating, created with host_token, private-mode auth required, invalid room, expired room, password required, and create failure.

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

Future tests: public room creation without token, private mode creation with token, host_token persistence, room metadata rendering, password-room path, and API error mapping.

*/

"use client";

import { FormEvent, useEffect, useState } from "react";
import { Lock, X } from "lucide-react";

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

        {validationError || error ? (
          <p className="mt-3 text-sm text-danger">{validationError ?? error}</p>
        ) : null}

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
