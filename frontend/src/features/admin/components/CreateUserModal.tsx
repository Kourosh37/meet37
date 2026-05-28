"use client";

import { FormEvent, useState } from "react";
import { adminUserCreateSchema } from "@/lib/utils/validators";
import type { CreateAdminUserRequest } from "@/types/api";

interface CreateUserModalProps {
  disabled?: boolean;
  onCreate: (request: CreateAdminUserRequest) => void;
}

export function CreateUserModal({
  disabled = false,
  onCreate
}: CreateUserModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = adminUserCreateSchema.safeParse({ password, username });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid user details");
      return;
    }

    setError(null);
    onCreate(result.data);
    setOpen(false);
    setPassword("");
    setUsername("");
  }

  if (!open) {
    return (
      <button
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        Create user
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-surface-foreground">
        Create user
      </h2>
      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username"
          value={username}
        />
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          value={password}
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex gap-2">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            disabled={disabled}
            type="submit"
          >
            Save
          </button>
          <button
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground"
            onClick={() => setOpen(false)}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
