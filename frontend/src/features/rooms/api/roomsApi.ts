/*
Frontend architecture note

File: src\features\rooms\api\roomsApi.ts
Layer: Rooms

Responsibility:
- Typed wrapper around backend room REST endpoints: create room, list rooms, read room metadata/live stats, delete room, chat history, and file history. It must keep the frontend contract aligned with backend/docs/API.md.

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

import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  AdminSettingsResponse,
  ChatHistoryItem,
  CreateRoomRequest,
  CreateRoomResponse,
  FileHistoryItem,
  Room,
  RoomDetailsResponse
} from "@/types/api";

export function getPublicSettings() {
  return apiRequest<AdminSettingsResponse>(endpoints.settings);
}

export function listRooms() {
  return apiRequest<Room[]>(endpoints.rooms.base);
}

export function createRoom(
  request: CreateRoomRequest,
  protectedRequest = false
) {
  return apiRequest<CreateRoomResponse, CreateRoomRequest>(
    endpoints.rooms.base,
    {
      body: request,
      method: "POST",
      protected: protectedRequest,
      retryOnUnauthorized: false
    }
  );
}

export function getRoom(roomId: string) {
  return apiRequest<RoomDetailsResponse>(endpoints.rooms.byId(roomId));
}

export function deleteRoom(roomId: string) {
  return apiRequest<void>(endpoints.rooms.byId(roomId), {
    method: "DELETE",
    protected: true,
    retryOnUnauthorized: true
  });
}

export function getRoomChat(roomId: string) {
  return apiRequest<ChatHistoryItem[]>(endpoints.rooms.chat(roomId));
}

export function getRoomFiles(roomId: string) {
  return apiRequest<FileHistoryItem[]>(endpoints.rooms.files(roomId));
}
