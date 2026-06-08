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
  return (
    typeof window !== "undefined" &&
    typeof window.sessionStorage !== "undefined"
  );
}

function canUseLocalStorage() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    typeof window.localStorage.getItem === "function" &&
    typeof window.localStorage.setItem === "function" &&
    typeof window.localStorage.removeItem === "function"
  );
}

export function sessionFromAuthResponse(
  response: AuthResponse
): StoredAuthSession {
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
  if (canUseLocalStorage()) {
    window.localStorage.setItem(`${HOST_TOKEN_PREFIX}${roomId}`, hostToken);
  }
}

export function getHostToken(roomId: string) {
  const memoryToken = memoryHostTokens.get(roomId);

  if (memoryToken) {
    return memoryToken;
  }

  if (!canUseSessionStorage()) {
    if (!canUseLocalStorage()) {
      return null;
    }

    const localToken = window.localStorage.getItem(
      `${HOST_TOKEN_PREFIX}${roomId}`
    );

    if (localToken) {
      memoryHostTokens.set(roomId, localToken);
    }

    return localToken;
  }

  const storedToken = window.sessionStorage.getItem(
    `${HOST_TOKEN_PREFIX}${roomId}`
  );

  if (storedToken) {
    memoryHostTokens.set(roomId, storedToken);
  }

  if (storedToken) {
    return storedToken;
  }

  if (!canUseLocalStorage()) {
    return null;
  }

  const localToken = window.localStorage.getItem(
    `${HOST_TOKEN_PREFIX}${roomId}`
  );

  if (localToken) {
    memoryHostTokens.set(roomId, localToken);
    window.sessionStorage.setItem(`${HOST_TOKEN_PREFIX}${roomId}`, localToken);
  }

  return localToken;
}

export function clearHostToken(roomId: string) {
  memoryHostTokens.delete(roomId);

  if (canUseSessionStorage()) {
    window.sessionStorage.removeItem(`${HOST_TOKEN_PREFIX}${roomId}`);
  }
  if (canUseLocalStorage()) {
    window.localStorage.removeItem(`${HOST_TOKEN_PREFIX}${roomId}`);
  }
}
