"use client";

import type { AdminUser, UpdateAdminUserRequest } from "@/types/api";
import { formatUnixSeconds } from "@/lib/utils/formatters";

interface UserTableProps {
  disabled?: boolean;
  onDelete: (userId: string) => void;
  onUpdate: (userId: string, request: UpdateAdminUserRequest) => void;
  users: AdminUser[];
}

export function UserTable({
  disabled = false,
  onDelete,
  onUpdate,
  users
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground shadow-sm">
        No private-mode users exist yet.
      </div>
    );
  }

  function handleRename(user: AdminUser) {
    const username = window.prompt("New username", user.username)?.trim();

    if (username && username !== user.username) {
      onUpdate(user.id, { username });
    }
  }

  function handlePassword(user: AdminUser) {
    const password = window.prompt("New password")?.trim();

    if (password) {
      onUpdate(user.id, { password });
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Username</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr className="border-t border-border" key={user.id}>
              <td className="px-4 py-3 font-medium text-surface-foreground">
                {user.username}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatUnixSeconds(user.created_at)}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold"
                    disabled={disabled}
                    onClick={() => handleRename(user)}
                    type="button"
                  >
                    Rename
                  </button>
                  <button
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold"
                    disabled={disabled}
                    onClick={() => handlePassword(user)}
                    type="button"
                  >
                    Password
                  </button>
                  <button
                    className="rounded-md border border-danger/30 px-2.5 py-1 text-xs font-semibold text-danger"
                    disabled={disabled}
                    onClick={() => onDelete(user.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
