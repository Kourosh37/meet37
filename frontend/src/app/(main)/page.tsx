/*
Frontend architecture note

File: src\app\(main)\page.tsx
Layer: Next.js Route

Responsibility:
- Frontend file for the Next.js Route layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

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

import { ArrowRight, Video } from "lucide-react";
import Link from "next/link";
import { RoomList } from "@/features/rooms/components/RoomList";

export default function HomePage() {
  return (
    <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <div className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-muted-foreground">
          <Video className="size-4 text-primary" />
          P2P-first meetings
        </div>
        <div className="space-y-4">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
            Start or join a secure browser meeting.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Create shareable rooms, collect a display name before entry, and keep host moderation
            ready for approval-based meetings.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            href="/rooms/new"
          >
            Create room
            <ArrowRight className="size-4" />
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-surface-foreground transition hover:bg-muted"
            href="/login"
          >
            Login
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-semibold text-surface-foreground">Active rooms</h2>
            <p className="text-sm text-muted-foreground">Room list integration starts in Phase 5.</p>
          </div>
        </div>
        <RoomList />
      </div>
    </section>
  );
}
