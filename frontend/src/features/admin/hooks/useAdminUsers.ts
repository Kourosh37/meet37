"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser
} from "@/features/admin/api/adminApi";
import type {
  CreateAdminUserRequest,
  UpdateAdminUserRequest
} from "@/types/api";

const adminUsersKey = ["admin", "users"] as const;

export function useAdminUsers() {
  const queryClient = useQueryClient();
  const users = useQuery({
    queryFn: listAdminUsers,
    queryKey: adminUsersKey
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: adminUsersKey });
  const createUser = useMutation({
    mutationFn: (request: CreateAdminUserRequest) => createAdminUser(request),
    onSuccess: () => {
      toast.success("User created");
      void invalidate();
    }
  });
  const updateUser = useMutation({
    mutationFn: ({
      request,
      userId
    }: {
      request: UpdateAdminUserRequest;
      userId: string;
    }) => updateAdminUser(userId, request),
    onSuccess: () => {
      toast.success("User updated");
      void invalidate();
    }
  });
  const deleteUser = useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: () => {
      toast.success("User deleted");
      void invalidate();
    }
  });

  return {
    createUser: createUser.mutate,
    deleteUser: deleteUser.mutate,
    error:
      users.error ?? createUser.error ?? updateUser.error ?? deleteUser.error,
    isLoading: users.isLoading,
    isMutating:
      createUser.isPending || updateUser.isPending || deleteUser.isPending,
    updateUser: updateUser.mutate,
    users: users.data ?? []
  };
}
