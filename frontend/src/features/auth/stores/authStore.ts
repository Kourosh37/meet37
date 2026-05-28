/*
Frontend architecture note

File: src\features\auth\stores\authStore.ts
Layer: Authentication

Responsibility:
- Client auth state store for current user, admin flag, access token lifetime, refresh token presence, loading state, and logout/reset transitions.

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

import { login, logout, refresh } from "@/features/auth/api/authApi";
import { setAccessTokenResolver, setUnauthorizedHandler } from "@/lib/api/client";
import {
  clearAuthSession,
  getAccessToken,
  getAuthSession,
  getRefreshToken,
  saveAuthSession,
  sessionFromAuthResponse,
  type StoredAuthSession
} from "@/lib/storage/tokenStorage";
import { create } from "zustand";

type AuthStatus = "anonymous" | "authenticated" | "authenticating" | "refreshing";

export interface AuthState {
  error: string | null;
  hydrated: boolean;
  session: StoredAuthSession | null;
  status: AuthStatus;
  isAdmin: boolean;
  isAuthenticated: boolean;
  hydrate: () => void;
  loginWithCredentials: (username: string, password: string) => Promise<StoredAuthSession>;
  refreshSession: () => Promise<boolean>;
  logoutSession: () => Promise<void>;
}

function setStoredSession(session: StoredAuthSession) {
  saveAuthSession(session);
  return {
    error: null,
    hydrated: true,
    isAdmin: session.isAdmin,
    isAuthenticated: true,
    session,
    status: "authenticated" as const
  };
}

function anonymousState(error: string | null = null) {
  clearAuthSession();
  return {
    error,
    hydrated: true,
    isAdmin: false,
    isAuthenticated: false,
    session: null,
    status: "anonymous" as const
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  error: null,
  hydrated: false,
  isAdmin: false,
  isAuthenticated: false,
  session: null,
  status: "anonymous",

  hydrate: () => {
    const session = getAuthSession();

    if (session) {
      set(setStoredSession(session));
      return;
    }

    set(anonymousState());
  },

  loginWithCredentials: async (username, password) => {
    set({ error: null, hydrated: true, status: "authenticating" });

    try {
      const response = await login({ password, username });
      const session = sessionFromAuthResponse(response);

      set(setStoredSession(session));
      return session;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      set(anonymousState(message));
      throw error;
    }
  },

  refreshSession: async () => {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      set(anonymousState("Session expired"));
      return false;
    }

    set({ error: null, hydrated: true, status: "refreshing" });

    try {
      const response = await refresh({ refresh_token: refreshToken });
      set(setStoredSession(sessionFromAuthResponse(response)));
      return true;
    } catch {
      set(anonymousState("Session expired"));
      return false;
    }
  },

  logoutSession: async () => {
    const refreshToken = getRefreshToken();

    try {
      if (refreshToken) {
        await logout({ refresh_token: refreshToken });
      }
    } finally {
      set(anonymousState());
    }
  }
}));

setAccessTokenResolver(getAccessToken);
setUnauthorizedHandler(() => useAuthStore.getState().refreshSession());
