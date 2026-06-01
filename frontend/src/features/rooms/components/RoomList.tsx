/*
Frontend architecture note

File: src\features\rooms\components\RoomList.tsx
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

"use client";

import { useRooms } from "@/features/rooms/hooks/useRoomMeta";
import { formatUnixSeconds } from "@/lib/utils/formatters";
import { Lock, Users, Video } from "lucide-react";
import Link from "next/link";

export function RoomList() {
  const { data: rooms, error, isLoading } = useRooms();

  if (isLoading) {
    return (
      <div className="space-y-3 py-6" aria-label="Loading rooms">
        {[0, 1, 2].map((item) => (
          <div className="h-20 animate-pulse rounded-md bg-muted" key={item} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
        Failed to load rooms.
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="py-10 text-center">
        <Video className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-surface-foreground">
          No active rooms
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a room to start the first meeting.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {rooms.map((room) => (
        <Link
          className="block py-4 transition hover:bg-muted/60"
          href={`/meet/${room.id}`}
          key={room.id}
        >
          <div className="flex items-start justify-between gap-4 px-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-surface-foreground">
                {room.name}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Created {formatUnixSeconds(room.created_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {room.has_password ? (
                <Lock className="size-4" aria-label="Password protected" />
              ) : null}
              <Users className="size-4" />
              {room.max_peers}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
