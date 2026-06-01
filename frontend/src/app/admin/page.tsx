/*
Frontend architecture note

File: src\app\admin\page.tsx
Layer: Admin Panel

Responsibility:
- Frontend file for the Admin Panel layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: /api/admin/settings for public/private mode, /api/admin/users for CRUD, /api/admin/rooms/{id}/stats for live room stats, and /api/admin/sfu/stats for relay stats. Every request requires an admin bearer token.

State model to plan: loading, unauthorized, forbidden, empty, optimistic mutation, mutation error, stale stats refresh, and confirmed delete/update.

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

Future tests: admin guard behavior, public/private toggle, user CRUD validation, room stats rendering, SFU stats rendering, and token failure handling.

*/

import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">
          Dashboard
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Admin data will be connected after auth and REST infrastructure are
          implemented.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["App mode", "Public/private toggle"],
          ["Live rooms", "Room stats"],
          ["SFU", "Relay metrics"]
        ].map(([title, detail]) => (
          <div
            className="rounded-lg border border-border bg-surface p-5 shadow-sm"
            key={title}
          >
            <h2 className="text-sm font-semibold text-surface-foreground">
              {title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
      <Link
        className="text-sm font-medium text-primary hover:text-primary/80"
        href="/admin/users"
      >
        Manage users
      </Link>
    </section>
  );
}
