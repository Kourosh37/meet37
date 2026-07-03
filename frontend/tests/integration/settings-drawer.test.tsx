import { render, screen } from "@testing-library/react";
import { SettingsDrawer } from "@/features/meeting/components/SettingsDrawer";
import { describe, expect, it, vi } from "vitest";

describe("SettingsDrawer", () => {
  it("shows the current room join policy for hosts", () => {
    render(
      <SettingsDrawer
        audioEnabled
        isHost
        isOpen
        joinPolicy="approval"
        onClose={vi.fn()}
        onToggleAudio={vi.fn()}
        onToggleScreenShare={vi.fn()}
        onToggleVideo={vi.fn()}
        screenSharing={false}
        videoEnabled
      />
    );

    expect(
      (screen.getByLabelText("Join policy") as HTMLSelectElement).value
    ).toBe("approval");
  });
});
