/*
Frontend architecture note

File: src\app\(main)\rooms\new\page.tsx
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

import { BrandMark } from "@/components/layout/BrandMark";
import Link from "next/link";
import { RoomCreationForm } from "@/features/rooms/components/RoomCreationForm";

export default function CreateRoomPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="mb-4 inline-flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 shadow-sm">
          <BrandMark className="h-8 w-8" />
          <p className="text-sm font-medium text-primary">Room setup</p>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">
          Create a room
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Create a shareable meeting link and keep host authority in this
          browser session.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <RoomCreationForm />
        <div className="mt-6">
          <Link
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
            href="/"
          >
            Back home
          </Link>
        </div>
      </div>
    </section>
  );
}
