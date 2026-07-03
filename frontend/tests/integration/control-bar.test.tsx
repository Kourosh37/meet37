import { fireEvent, render, screen } from "@testing-library/react";
import { ControlBar } from "@/features/meeting/components/ControlBar";
import { describe, expect, it, vi } from "vitest";

function renderControlBar(overrides = {}) {
  return render(
    <ControlBar
      audioEnabled
      onCopyInvite={vi.fn()}
      onLeave={vi.fn()}
      onOpenSettings={vi.fn()}
      onReaction={vi.fn()}
      onToggleAudio={vi.fn()}
      onToggleChat={vi.fn()}
      onToggleScreenShare={vi.fn()}
      onToggleVideo={vi.fn()}
      screenSharing={false}
      videoEnabled
      {...overrides}
    />
  );
}

describe("ControlBar", () => {
  it("keeps unsupported screen sharing clickable so the media hook can report the reason", () => {
    const onToggleScreenShare = vi.fn();
    renderControlBar({
      onToggleScreenShare,
      screenShareSupported: false,
      screenShareUnavailableReason: "Screen sharing is not supported."
    });

    const button = screen.getByRole("button", { name: "Share screen" });
    expect(button).toHaveProperty("disabled", false);
    expect(button.getAttribute("title")).toBe(
      "Screen sharing is not supported."
    );

    fireEvent.click(button);
    expect(onToggleScreenShare).toHaveBeenCalledTimes(1);
  });

  it("opens device selection from the microphone arrow", () => {
    const onSelectAudioDevice = vi.fn();
    renderControlBar({
      audioInputs: [
        {
          deviceId: "mic-1",
          groupId: "group-1",
          kind: "audioinput",
          label: "External mic",
          toJSON: () => ({})
        } as MediaDeviceInfo
      ],
      onSelectAudioDevice
    });

    fireEvent.click(screen.getByRole("button", { name: "Select microphone" }));
    fireEvent.click(screen.getByRole("option", { name: "External mic" }));

    expect(onSelectAudioDevice).toHaveBeenCalledWith("mic-1");
  });

  it("opens the reaction picker and sends the selected emoji", () => {
    const onReaction = vi.fn();
    renderControlBar({ onReaction });

    fireEvent.click(screen.getByRole("button", { name: "Send reaction" }));
    fireEvent.click(screen.getByRole("button", { name: "Send 👏 reaction" }));

    expect(onReaction).toHaveBeenCalledWith("👏");
  });
  it("shows capped unread chat count on the chat button", () => {
    const { rerender } = renderControlBar({ chatUnreadCount: 7 });

    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open chat (7)" })).toBeTruthy();

    rerender(
      <ControlBar
        audioEnabled
        chatUnreadCount={120}
        onCopyInvite={vi.fn()}
        onLeave={vi.fn()}
        onOpenSettings={vi.fn()}
        onReaction={vi.fn()}
        onToggleAudio={vi.fn()}
        onToggleChat={vi.fn()}
        onToggleScreenShare={vi.fn()}
        onToggleVideo={vi.fn()}
        screenSharing={false}
        videoEnabled
      />
    );

    expect(screen.getByText("+99")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open chat (+99)" })).toBeTruthy();
  });
});
