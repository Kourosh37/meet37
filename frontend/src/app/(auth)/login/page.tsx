/*
Frontend architecture note

File: src\app\(auth)\login\page.tsx
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

import Link from "next/link";

export default function LoginPage() {
  return (
    <section className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-normal text-surface-foreground">Login</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Admin and private-mode user authentication will be wired in Phase 4.
        </p>
      </div>
      <div className="mt-6 grid gap-4">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-muted" aria-hidden="true" />
          <div className="h-11 rounded-md border border-border bg-background" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-muted" aria-hidden="true" />
          <div className="h-11 rounded-md border border-border bg-background" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between gap-3">
        <Link className="text-sm font-medium text-muted-foreground hover:text-foreground" href="/">
          Back home
        </Link>
        <button
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground opacity-60"
          disabled
          type="button"
        >
          Sign in
        </button>
      </div>
    </section>
  );
}
