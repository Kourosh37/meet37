/*
Frontend architecture note

File: src\lib\api\endpoints.ts
Layer: REST API Infrastructure

Responsibility:
- Central endpoint map for all REST paths so feature modules never hard-code backend URLs.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: all REST paths and response shapes must be sourced from backend/docs/API.md and normalized before reaching React components.

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

const encodePathSegment = (value: string) => encodeURIComponent(value);

export const endpoints = {
  health: "/health",
  auth: {
    login: "/api/auth/login",
    refresh: "/api/auth/refresh",
    logout: "/api/auth/logout",
    register: "/api/auth/register"
  },
  rooms: {
    base: "/api/rooms",
    byId: (roomId: string) => `/api/rooms/${encodePathSegment(roomId)}`,
    chat: (roomId: string) => `/api/rooms/${encodePathSegment(roomId)}/chat`,
    files: (roomId: string) => `/api/rooms/${encodePathSegment(roomId)}/files`
  },
  admin: {
    settings: "/api/admin/settings",
    users: "/api/admin/users",
    user: (userId: string) => `/api/admin/users/${encodePathSegment(userId)}`,
    roomStats: (roomId: string) => `/api/admin/rooms/${encodePathSegment(roomId)}/stats`,
    sfuStats: "/api/admin/sfu/stats"
  }
} as const;
