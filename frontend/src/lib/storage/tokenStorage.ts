/*
Frontend architecture note

File: src\lib\storage\tokenStorage.ts
Layer: Frontend Foundation

Responsibility:
- Frontend file for the Frontend Foundation layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

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

import type { AuthResponse } from "@/types/api";

const AUTH_SESSION_KEY = "meet_auth_session";
const HOST_TOKEN_PREFIX = "meet_host_token:";

export interface StoredAuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
  userId: string;
  username: string;
  isAdmin: boolean;
}

let memorySession: StoredAuthSession | null = null;
const memoryHostTokens = new Map<string, string>();

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function sessionFromAuthResponse(response: AuthResponse): StoredAuthSession {
  return {
    accessToken: response.access_token,
    expiresAt: response.expires_at,
    isAdmin: response.is_admin,
    refreshExpiresAt: response.refresh_expires_at,
    refreshToken: response.refresh_token,
    userId: response.user_id,
    username: response.username
  };
}

export function saveAuthSession(session: StoredAuthSession) {
  memorySession = session;

  if (canUseSessionStorage()) {
    window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  }
}

export function getAuthSession() {
  if (memorySession) {
    return memorySession;
  }

  if (!canUseSessionStorage()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(AUTH_SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    memorySession = JSON.parse(raw) as StoredAuthSession;
    return memorySession;
  } catch {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

export function getAccessToken() {
  return getAuthSession()?.accessToken ?? null;
}

export function getRefreshToken() {
  return getAuthSession()?.refreshToken ?? null;
}

export function clearAuthSession() {
  memorySession = null;

  if (canUseSessionStorage()) {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
  }
}

export function saveHostToken(roomId: string, hostToken: string) {
  memoryHostTokens.set(roomId, hostToken);

  if (canUseSessionStorage()) {
    window.sessionStorage.setItem(`${HOST_TOKEN_PREFIX}${roomId}`, hostToken);
  }
}

export function getHostToken(roomId: string) {
  const memoryToken = memoryHostTokens.get(roomId);

  if (memoryToken) {
    return memoryToken;
  }

  if (!canUseSessionStorage()) {
    return null;
  }

  const storedToken = window.sessionStorage.getItem(`${HOST_TOKEN_PREFIX}${roomId}`);

  if (storedToken) {
    memoryHostTokens.set(roomId, storedToken);
  }

  return storedToken;
}

export function clearHostToken(roomId: string) {
  memoryHostTokens.delete(roomId);

  if (canUseSessionStorage()) {
    window.sessionStorage.removeItem(`${HOST_TOKEN_PREFIX}${roomId}`);
  }
}
