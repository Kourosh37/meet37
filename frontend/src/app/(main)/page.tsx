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

import { BrandMark } from "@/components/layout/BrandMark";
import { ArrowRight, LogIn, Video } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-4xl flex-col justify-center py-10">
      <div className="space-y-7">
        <div className="inline-flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
          <BrandMark className="h-10 w-10" size={40} />
          <span className="text-base font-semibold text-surface-foreground">
            meet37
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground">
          <Video className="size-4 text-primary" />
          Browser meetings
        </div>
        <div className="space-y-5">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-foreground sm:text-6xl">
            Start a meeting and share the link.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Create a room in seconds, enter with a display name, and keep the
            meeting controls focused on the call.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            href="/rooms/new"
          >
            Create room
            <ArrowRight className="size-4" />
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-3 text-sm font-semibold text-surface-foreground transition hover:bg-muted"
            href="/login"
          >
            <LogIn className="size-4" />
            Login
          </Link>
        </div>
      </div>
    </section>
  );
}
