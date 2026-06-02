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

import { BrandMark } from "@/components/layout/BrandMark";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <section className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="space-y-2">
        <div className="mb-4 inline-flex items-center gap-3">
          <BrandMark className="h-10 w-10" size={40} />
          <span className="text-base font-semibold text-surface-foreground">
            meet37
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-normal text-surface-foreground">
          Login
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Sign in as an admin or private-mode user.
        </p>
      </div>
      <LoginForm />
      <div className="mt-6">
        <Link
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
          href="/"
        >
          Back home
        </Link>
      </div>
    </section>
  );
}
