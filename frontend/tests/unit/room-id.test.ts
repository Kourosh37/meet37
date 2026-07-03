import { normalizeRoomIdInput } from "@/features/rooms/lib/roomId";
import { describe, expect, it } from "vitest";

describe("room id normalization", () => {
  it("accepts room ids with different casing and optional separators", () => {
    expect(normalizeRoomIdInput("ABC-def-Ghi")).toBe("abc-def-ghi");
    expect(normalizeRoomIdInput("abcdefghi")).toBe("abc-def-ghi");
    expect(normalizeRoomIdInput("abc def ghi")).toBe("abc-def-ghi");
  });

  it("rejects malformed room ids", () => {
    expect(normalizeRoomIdInput("abc-def")).toBe("");
    expect(normalizeRoomIdInput("abc-123-ghi")).toBe("");
  });
});
