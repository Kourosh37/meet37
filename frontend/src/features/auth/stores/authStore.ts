import { login, logout, refresh } from "@/features/auth/api/authApi";
import {
  setAccessTokenResolver,
  setUnauthorizedHandler
} from "@/lib/api/client";
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

type AuthStatus =
  | "anonymous"
  | "authenticated"
  | "authenticating"
  | "refreshing";

export interface AuthState {
  error: string | null;
  hydrated: boolean;
  session: StoredAuthSession | null;
  status: AuthStatus;
  isAdmin: boolean;
  isAuthenticated: boolean;
  hydrate: () => void;
  loginWithCredentials: (
    username: string,
    password: string
  ) => Promise<StoredAuthSession>;
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
