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
  it("disables screen sharing when the browser does not support it", () => {
    const onToggleScreenShare = vi.fn();
    renderControlBar({
      onToggleScreenShare,
      screenShareSupported: false,
      screenShareUnavailableReason: "Screen sharing is not supported."
    });

    const button = screen.getByRole("button", { name: "Share screen" });
    expect(button).toHaveProperty("disabled", true);

    fireEvent.click(button);
    expect(onToggleScreenShare).not.toHaveBeenCalled();
  });
});
