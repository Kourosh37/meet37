/*
Frontend architecture note

File: src\hooks\useKeyboard.ts
Layer: Shared Hooks

Responsibility:
- Frontend file for the Shared Hooks layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: keep this file aligned with backend/docs/API.md and backend/docs/WEBSOCKET.md when it touches server data or signaling.

State model to plan: loading, ready, empty, recoverable error, fatal error, and cleanup/unmount behavior where applicable.

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

Future tests: success path, loading path, error path, accessibility expectations, and cleanup/side-effect boundaries.

*/

"use client";

import { useEffect } from "react";

type KeyboardHandler = (event: KeyboardEvent) => void;

interface KeyboardShortcut {
  altKey?: boolean;
  ctrlKey?: boolean;
  enabled?: boolean;
  handler: KeyboardHandler;
  key: string;
  metaKey?: boolean;
  shiftKey?: boolean;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea"
  );
}

function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut) {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    Boolean(event.altKey) === Boolean(shortcut.altKey) &&
    Boolean(event.ctrlKey) === Boolean(shortcut.ctrlKey) &&
    Boolean(event.metaKey) === Boolean(shortcut.metaKey) &&
    Boolean(event.shiftKey) === Boolean(shortcut.shiftKey)
  );
}

export function useKeyboard(shortcuts: KeyboardShortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      const shortcut = shortcuts.find(
        (candidate) =>
          candidate.enabled !== false && matchesShortcut(event, candidate)
      );

      if (!shortcut) {
        return;
      }

      event.preventDefault();
      shortcut.handler(event);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, shortcuts]);
}
