/*
Frontend architecture note

File: src\components\layout\TopBar.tsx
Layer: Layout Shell

Responsibility:
- Frontend file for the Layout Shell layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

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

import { BrandMark } from "@/components/layout/BrandMark";
import { ThemeSwitch } from "@/components/layout/ThemeSwitch";
import { LogIn, Plus } from "lucide-react";
import Link from "next/link";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 border-x border-border px-4 sm:px-6">
        <Link
          className="inline-flex items-center gap-2 text-lg font-semibold tracking-normal text-foreground"
          href="/"
        >
          <BrandMark className="h-8 w-8" />
          meet37
        </Link>
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-2"
        >
          <ThemeSwitch />
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            href="/login"
          >
            <LogIn className="size-4" />
            Login
          </Link>
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            href="/rooms/new"
          >
            <Plus className="size-4" />
            New room
          </Link>
        </nav>
      </div>
    </header>
  );
}
