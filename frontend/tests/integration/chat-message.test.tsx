import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatMessage } from "@/features/meeting/components/ChatMessage";
import { describe, expect, it, vi } from "vitest";

describe("ChatMessage", () => {
  it("copies the message text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    render(
      <ChatMessage
        message={{
          displayName: "Alice",
          id: "message-1",
          text: "Copy this message",
          timestamp: 1_000
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Copy this message");
    });
  });
});
