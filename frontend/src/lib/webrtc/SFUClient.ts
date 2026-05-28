/*
Frontend architecture note

File: src\lib\webrtc\SFUClient.ts
Layer: WebRTC Infrastructure

Responsibility:
- Client-side SFU fallback adapter used after backend emits sfu-switch; it should isolate relay-mode negotiation from normal P2P logic.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: backend relays signaling only in P2P mode and announces SFU fallback through WebSocket. Browser media/data logic stays client-side.

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

// SFU client placeholder.
//
// Planned responsibilities:
// - Manage the dedicated SFU RTCPeerConnection.
// - Send offers, apply answers, exchange ICE, and handle renegotiation.
