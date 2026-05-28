/*
Frontend architecture note

File: src\components\layout\Sidebar.tsx
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

import { Activity, Gauge, Settings, Users } from "lucide-react";
import Link from "next/link";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/rooms", label: "Rooms", icon: Activity },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  return (
    <aside className="border-b border-border bg-surface md:min-h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex h-16 items-center border-b border-border px-4">
        <Link className="font-semibold text-surface-foreground" href="/">
          Meet Admin
        </Link>
      </div>
      <nav aria-label="Admin navigation" className="flex gap-2 overflow-x-auto p-3 md:flex-col">
        {adminLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              href={item.href}
              key={item.href}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
