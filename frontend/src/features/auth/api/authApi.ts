/*
Frontend architecture note

File: src\features\auth\api\authApi.ts
Layer: Authentication

Responsibility:
- Typed wrapper around backend auth endpoints: login, refresh, logout, and optional admin-only compatibility registration. It must not own UI state directly.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: POST /api/auth/login, POST /api/auth/refresh, POST /api/auth/logout; admin-only user creation must go through /api/admin/users unless compatibility registration is explicitly needed.

State model to plan: anonymous, authenticating, authenticated user, authenticated admin, refreshing, expired, and logout complete.

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

Future tests: login success/failure, token persistence, refresh rotation, logout revocation, admin/user role branching, and unauthorized redirects.

*/

// Auth API placeholder.
//
// Planned responsibilities:
// - Wrap POST /api/auth/login, /refresh, and /logout.
// - Keep auth response typing aligned with backend docs.
// - Avoid coupling token storage to raw HTTP calls.
