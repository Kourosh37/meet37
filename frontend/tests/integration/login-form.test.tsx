import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { useAuthStore } from "@/features/auth/stores/authStore";
import { clearAuthSession, getAuthSession } from "@/lib/storage/tokenStorage";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

beforeEach(() => {
  push.mockReset();
  clearAuthSession();
  useAuthStore.setState({
    error: null,
    hydrated: true,
    isAdmin: false,
    isAuthenticated: false,
    session: null,
    status: "anonymous"
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        access_token: "access-token",
        expires_at: Math.floor(Date.now() / 1000) + 900,
        is_admin: true,
        refresh_expires_at: Math.floor(Date.now() / 1000) + 86_400,
        refresh_token: "refresh-token",
        user_id: "admin",
        username: "admin"
      })
    )
  );
});

describe("LoginForm", () => {
  it("submits credentials, stores the session, and routes admins to admin", async () => {
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "admin-pass" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/login",
      expect.objectContaining({
        body: JSON.stringify({ password: "admin-pass", username: "admin" }),
        method: "POST"
      })
    );
    expect(getAuthSession()?.accessToken).toBe("access-token");
  });
});
