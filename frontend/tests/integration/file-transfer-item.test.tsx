import { render, screen } from "@testing-library/react";
import { FileTransferItem } from "@/features/meeting/components/FileTransferItem";
import type { FileTransferRecord } from "@/features/meeting/types/file";
import { describe, expect, it } from "vitest";

function transfer(overrides: Partial<FileTransferRecord>): FileTransferRecord {
  return {
    createdAt: 1,
    direction: "incoming",
    fileId: "file-1",
    mime: "text/plain",
    name: "notes.txt",
    progress: {
      bytesTransferred: 100,
      fileId: "file-1",
      percentage: 100,
      totalBytes: 100
    },
    senderPeerId: "peer-1",
    size: 100,
    status: "completed",
    targetPeerId: "peer-2",
    ...overrides
  };
}

describe("FileTransferItem", () => {
  it("removes the progress indicator once a transfer is completed", () => {
    render(
      <FileTransferItem
        transfer={transfer({
          objectUrl: "blob:download"
        })}
      />
    );

    expect(screen.getByText(/completed/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /download/i })).toBeTruthy();
    expect(screen.queryByText("100%")).toBeNull();
  });

  it("shows progress while a transfer is still active", () => {
    render(
      <FileTransferItem
        transfer={transfer({
          objectUrl: undefined,
          progress: {
            bytesTransferred: 50,
            fileId: "file-1",
            percentage: 50,
            totalBytes: 100
          },
          status: "transferring"
        })}
      />
    );

    expect(screen.getByText("50%")).toBeTruthy();
  });
});
