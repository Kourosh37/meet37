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
import { afterEach, describe, expect, it } from "vitest";

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

afterEach(() => {
  clearAuthSession();
  clearHostToken("room-1");
  window.sessionStorage.clear();
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
    expect(window.sessionStorage.getItem("meet_auth_session")).toContain("access");
  });

  it("stores host tokens by room without putting them in URLs", () => {
    saveHostToken("room-1", "host-token");

    expect(getHostToken("room-1")).toBe("host-token");
    clearHostToken("room-1");
    expect(getHostToken("room-1")).toBeNull();
  });
});
