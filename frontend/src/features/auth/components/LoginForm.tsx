"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { InlineError } from "@/components/feedback/InlineError";
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
        <InlineError message={errors.username?.message} />
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
        <InlineError message={errors.password?.message} />
      </div>

      <InlineError message={error} />

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
