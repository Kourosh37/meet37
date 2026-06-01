import { middleware } from "@/middleware";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

describe("middleware", () => {
  it("adds browser security headers to frontend responses", () => {
    const response = middleware(new NextRequest("http://127.0.0.1:3001/admin"));

    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.headers.get("Permissions-Policy")).toContain("camera");
  });
});
