import {
  clearAuthSession,
  clearHostToken,
  getAccessToken,
  getAuthSession,
  getHostToken,
  saveAuthSession,
  saveHostToken,
  sessionFromAuthResponse
} from "@/lib/storage/tokenStorage";
import type { AuthResponse } from "@/types/api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const authResponse: AuthResponse = {
  access_token: "access",
  expires_at: 100,
  is_admin: true,
  refresh_expires_at: 200,
  refresh_token: "refresh",
  token: "access",
  token_type: "Bearer",
  user_id: "admin",
  username: "admin"
};

function createStorageMock() {
  const values = new Map<string, string>();

  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: createStorageMock()
  });
});

afterEach(() => {
  clearAuthSession();
  clearHostToken("room-1");
  clearHostToken("room-2");
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("tokenStorage", () => {
  it("maps auth responses into stored sessions", () => {
    const session = sessionFromAuthResponse(authResponse);

    expect(session).toMatchObject({
      accessToken: "access",
      isAdmin: true,
      refreshToken: "refresh",
      userId: "admin"
    });
  });

  it("stores auth sessions in memory and sessionStorage", () => {
    const session = sessionFromAuthResponse(authResponse);

    saveAuthSession(session);

    expect(getAuthSession()).toEqual(session);
    expect(getAccessToken()).toBe("access");
    expect(window.sessionStorage.getItem("meet_auth_session")).toContain(
      "access"
    );
  });

  it("stores host tokens by room without putting them in URLs", () => {
    saveHostToken("room-1", "host-token");

    expect(getHostToken("room-1")).toBe("host-token");
    clearHostToken("room-1");
    expect(getHostToken("room-1")).toBeNull();
  });

  it("restores host tokens from localStorage after sessionStorage is cleared", () => {
    window.localStorage.setItem("meet_host_token:room-2", "local-host-token");

    expect(getHostToken("room-2")).toBe("local-host-token");
    expect(window.sessionStorage.getItem("meet_host_token:room-2")).toBe(
      "local-host-token"
    );
  });
});
