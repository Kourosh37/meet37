"use client";

import { InlineError } from "@/components/feedback/InlineError";
import { CreateUserModal } from "@/features/admin/components/CreateUserModal";
import { UserTable } from "@/features/admin/components/UserTable";
import { useAdminUsers } from "@/features/admin/hooks/useAdminUsers";
import { useLocale } from "@/providers/LocaleProvider";

export default function AdminUsersPage() {
  const users = useAdminUsers();
  const { t } = useLocale();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-foreground">
            {t("admin.users")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("admin.usersDescription")}
          </p>
        </div>
        <CreateUserModal
          disabled={users.isMutating}
          onCreate={users.createUser}
        />
      </div>
      <InlineError message={users.error ? t("error.couldNotLoadUsers") : null} />
      <UserTable
        disabled={users.isLoading || users.isMutating}
        onDelete={users.deleteUser}
        onUpdate={(userId, request) => users.updateUser({ request, userId })}
        users={users.users}
      />
    </section>
  );
}
