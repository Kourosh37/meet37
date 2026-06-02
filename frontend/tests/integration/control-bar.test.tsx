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
      onToggleAudio={vi.fn()}
      onToggleChat={vi.fn()}
      onToggleParticipants={vi.fn()}
      onToggleScreenShare={vi.fn()}
      onToggleVideo={vi.fn()}
      participantsOpen={false}
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
});
