/*
Frontend architecture note

File: src\features\rooms\hooks\useCreateRoom.ts
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

import { createRoom } from "@/features/rooms/api/roomsApi";
import { roomQueryKeys } from "@/features/rooms/hooks/useRoomMeta";
import { getAuthSession, saveHostToken } from "@/lib/storage/tokenStorage";
import type { CreateRoomRequest } from "@/types/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateRoomRequest) => createRoom(request, getAuthSession() !== null),
    onSuccess: (response) => {
      saveHostToken(response.room.id, response.host_token);
      void queryClient.invalidateQueries({ queryKey: roomQueryKeys.all });
    }
  });
}
