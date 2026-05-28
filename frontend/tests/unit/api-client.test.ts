import { apiRequest, setAccessTokenResolver, setUnauthorizedHandler } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn<typeof fetch>();

globalThis.fetch = fetchMock;

afterEach(() => {
  fetchMock.mockReset();
  vi.restoreAllMocks();
  setAccessTokenResolver(undefined);
  setUnauthorizedHandler(undefined);
});

describe("endpoints", () => {
  it("encodes path segments", () => {
    expect(endpoints.rooms.byId("room/a b")).toBe("/api/rooms/room%2Fa%20b");
    expect(endpoints.admin.user("user/a")).toBe("/api/admin/users/user%2Fa");
  });
});

describe("apiRequest", () => {
  it("normalizes backend error responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "wrong room password" }), {
        headers: { "Content-Type": "application/json" },
        status: 403
      })
    );

    await expect(apiRequest("/api/rooms")).rejects.toMatchObject({
      message: "wrong room password",
      status: 403
    });
  });

  it("attaches bearer tokens for protected requests", async () => {
    setAccessTokenResolver(() => "access-token");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      })
    );

    await apiRequest<{ ok: boolean }>("/api/admin/settings", { protected: true });

    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Headers).get("Authorization")).toBe("Bearer access-token");
  });

  it("refreshes once and retries safe unauthorized requests", async () => {
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
    setUnauthorizedHandler(() => true);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "expired" }), {
          headers: { "Content-Type": "application/json" },
          status: 401
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ app_mode: "public" }), {
          headers: { "Content-Type": "application/json" },
          status: 200
        })
      );

    await expect(apiRequest("/api/admin/settings", { protected: true })).resolves.toEqual({
      app_mode: "public"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
