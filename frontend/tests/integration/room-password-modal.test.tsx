import { fireEvent, render, screen } from "@testing-library/react";
import { RoomPasswordModal } from "@/features/rooms/components/RoomPasswordModal";
import { describe, expect, it, vi } from "vitest";

describe("RoomPasswordModal", () => {
  it("requires a password and returns it without persistence", () => {
    const onSubmit = vi.fn();

    render(
      <RoomPasswordModal
        isOpen
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        roomName="Secure room"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(screen.getByText("Room password is required.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret-room-pass" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(onSubmit).toHaveBeenCalledWith("secret-room-pass");
  });
});
