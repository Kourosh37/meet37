import {
  chunkBlob,
  MAX_FILE_SIZE_BYTES,
  reassembleChunks
} from "@/lib/utils/fileChunker";
import { formatBytes, isUnixSecondsExpired } from "@/lib/utils/formatters";
import { createLogger } from "@/lib/utils/logger";
import {
  adminUserCreateSchema,
  adminUserUpdateSchema,
  displayNameSchema,
  loginSchema,
  roomCreationSchema
} from "@/lib/utils/validators";
import { describe, expect, it, vi } from "vitest";

describe("validators", () => {
  it("normalizes room creation defaults", () => {
    const result = roomCreationSchema.parse({ name: "Daily sync" });

    expect(result).toEqual({
      expires_in: 0,
      join_policy: "open",
      max_peers: 50,
      name: "Daily sync"
    });
  });

  it("enforces auth, display name, and admin user constraints", () => {
    expect(displayNameSchema.safeParse("  Sara  ").success).toBe(true);
    expect(displayNameSchema.safeParse("   ").success).toBe(false);
    expect(
      loginSchema.safeParse({ username: "admin", password: "secret" }).success
    ).toBe(true);
    expect(
      adminUserCreateSchema.safeParse({ username: "ab", password: "12345678" })
        .success
    ).toBe(false);
    expect(adminUserUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("formatters", () => {
  it("formats byte counts and expiry windows", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(isUnixSecondsExpired(Math.floor(Date.now() / 1000) - 60)).toBe(true);
  });
});

describe("fileChunker", () => {
  it("chunks and reassembles blobs in order", async () => {
    const blob = new Blob(["abcdef"]);
    const chunks = [];

    for await (const chunk of chunkBlob("file-1", blob, 2)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({
      fileId: "file-1",
      index: 0,
      totalChunks: 3
    });
    expect(
      chunks.map((chunk) => new TextDecoder().decode(chunk.bytes)).join("")
    ).toBe("abcdef");

    const reassembled = reassembleChunks(chunks.reverse(), "text/plain");
    expect(reassembled.size).toBe(6);
    expect(reassembled.type).toBe("text/plain");
  });

  it("rejects files over the frontend policy limit", async () => {
    const blob = new Blob([new ArrayBuffer(MAX_FILE_SIZE_BYTES + 1)]);
    const iterator = chunkBlob("file-2", blob);

    await expect(iterator.next()).rejects.toThrow("500 MB");
  });
});

describe("logger", () => {
  it("redacts sensitive fields before writing context", () => {
    const debugSpy = vi
      .spyOn(console, "debug")
      .mockImplementation(() => undefined);

    createLogger("api").debug("request", {
      access_token: "secret",
      nested: {
        sdp: "session",
        safe: "value"
      }
    });

    expect(debugSpy).toHaveBeenCalledWith("[api] request", {
      access_token: "[redacted]",
      nested: {
        safe: "value",
        sdp: "[redacted]"
      }
    });

    debugSpy.mockRestore();
  });
});
