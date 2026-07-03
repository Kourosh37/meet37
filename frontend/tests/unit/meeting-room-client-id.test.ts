import {
  getMeetingClientId,
  MEETING_CLIENT_ID_KEY
} from "@/features/meeting/hooks/useMeetingRoom";
import { beforeEach, describe, expect, it } from "vitest";

function createStorageMock() {
  const values = new Map<string, string>();

  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

describe("meeting client id", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorageMock()
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: createStorageMock()
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("keeps the client id stable only inside the current tab session", () => {
    window.localStorage.setItem("meet_client_id", "shared-across-tabs");

    const first = getMeetingClientId();
    const second = getMeetingClientId();

    expect(first).toBe(second);
    expect(first).not.toBe("shared-across-tabs");
    expect(window.sessionStorage.getItem(MEETING_CLIENT_ID_KEY)).toBe(first);
    expect(window.localStorage.getItem(MEETING_CLIENT_ID_KEY)).toBeNull();
  });
});
