/*
Frontend architecture note

File: src\features\auth\components\LoginForm.tsx
Layer: Authentication

Responsibility:
- Login form for admin and private-mode users that calls POST /api/auth/login and stores access/refresh tokens through the auth layer.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: POST /api/auth/login, POST /api/auth/refresh, POST /api/auth/logout; admin-only user creation must go through /api/admin/users unless compatibility registration is explicitly needed.

State model to plan: anonymous, authenticating, authenticated user, authenticated admin, refreshing, expired, and logout complete.

UX and edge cases to plan:
- Display clear loading and empty states instead of rendering nothing once implementation starts.
- Normalize backend errors into user-safe messages while preserving technical details for logger.ts.
- Keep room links shareable; never require global login just to open an existing meeting link.
- In private app mode, require login only for room creation, not for joining a shared room link.
- Every meeting participant must provide a non-empty display name before joining.

Security and privacy notes:
- Never expose refresh tokens to arbitrary components; use the storage/auth layer only.
- Treat host_token as room-scoped moderation authority and avoid leaking it into URLs or logs.
- Do not persist raw media streams, SDP blobs, ICE candidates, or file bytes unless a later backend feature explicitly requires it.

Future tests: login success/failure, token persistence, refresh rotation, logout revocation, admin/user role branching, and unauthorized redirects.

*/

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { loginSchema, type LoginFormValues } from "@/lib/utils/validators";

export function LoginForm() {
  const router = useRouter();
  const { error, loginWithCredentials, status } = useAuth();
  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  const isSubmitting = status === "authenticating";

  async function onSubmit(values: LoginFormValues) {
    try {
      const session = await loginWithCredentials(
        values.username,
        values.password
      );

      toast.success("Signed in");
      router.push(session.isAdmin ? "/admin" : "/rooms/new");
    } catch {
      toast.error("Login failed");
    }
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <label
          className="text-sm font-medium text-surface-foreground"
          htmlFor="username"
        >
          Username
        </label>
        <input
          autoComplete="username"
          className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          id="username"
          type="text"
          {...register("username")}
        />
        {errors.username ? (
          <p className="text-sm text-danger">{errors.username.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-medium text-surface-foreground"
          htmlFor="password"
        >
          Password
        </label>
        <input
          autoComplete="current-password"
          className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          id="password"
          type="password"
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-sm text-danger">{errors.password.message}</p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <button
        className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
