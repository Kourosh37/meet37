import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppModeToggle } from "@/features/admin/components/AppModeToggle";
import { UserTable } from "@/features/admin/components/UserTable";
import { describe, expect, it, vi } from "vitest";

describe("admin panel components", () => {
  it("lets an admin switch app mode", async () => {
    const onChange = vi.fn();
    render(<AppModeToggle appMode="public" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Private" }));

    expect(onChange).toHaveBeenCalledWith("private");
  });

  it("renders user rows and delete actions", async () => {
    const onDelete = vi.fn();
    render(
      <UserTable
        onDelete={onDelete}
        onUpdate={vi.fn()}
        users={[{ created_at: 1_700_000_000, id: "user-1", username: "sara" }]}
      />
    );

    expect(screen.getByText("sara")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("user-1");
  });
});
