"use client";

import { FormEvent, useState } from "react";
import { InlineError } from "@/components/feedback/InlineError";
import { adminUserCreateSchema } from "@/lib/utils/validators";
import { useLocale } from "@/providers/LocaleProvider";
import type { CreateAdminUserRequest } from "@/types/api";

interface CreateUserModalProps {
  disabled?: boolean;
  onCreate: (request: CreateAdminUserRequest) => void;
}

export function CreateUserModal({
  disabled = false,
  onCreate
}: CreateUserModalProps) {
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = adminUserCreateSchema.safeParse({ password, username });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? t("error.invalidUserDetails"));
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
        {t("admin.createUser")}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-surface-foreground">
        {t("admin.createUser")}
      </h2>
      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          onChange={(event) => setUsername(event.target.value)}
          placeholder={t("auth.username")}
          value={username}
        />
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t("auth.password")}
          type="password"
          value={password}
        />
        <InlineError message={error} />
        <div className="flex gap-2">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            disabled={disabled}
            type="submit"
          >
            {t("common.save")}
          </button>
          <button
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground"
            onClick={() => setOpen(false)}
            type="button"
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
