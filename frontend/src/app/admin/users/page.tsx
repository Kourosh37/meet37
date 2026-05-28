"use client";

import { CreateUserModal } from "@/features/admin/components/CreateUserModal";
import { UserTable } from "@/features/admin/components/UserTable";
import { useAdminUsers } from "@/features/admin/hooks/useAdminUsers";

export default function AdminUsersPage() {
  const users = useAdminUsers();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-foreground">
            Users
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Manage accounts allowed to create rooms in private mode.
          </p>
        </div>
        <CreateUserModal
          disabled={users.isMutating}
          onCreate={users.createUser}
        />
      </div>
      {users.error ? (
        <p className="text-sm text-danger">Could not load users.</p>
      ) : null}
      <UserTable
        disabled={users.isLoading || users.isMutating}
        onDelete={users.deleteUser}
        onUpdate={(userId, request) => users.updateUser({ request, userId })}
        users={users.users}
      />
    </section>
  );
}
