/*
Frontend architecture note

File: src\app\not-found.tsx
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
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <BrandMark className="h-12 w-12" size={48} />
        </div>
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-surface-foreground">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This route does not exist in the meeting app.
        </p>
        <Link
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          href="/"
        >
          Go home
        </Link>
      </section>
    </main>
  );
}
