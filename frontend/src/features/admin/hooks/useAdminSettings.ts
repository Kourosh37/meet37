"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminSettings,
  updateAdminSettings
} from "@/features/admin/api/adminApi";
import { roomQueryKeys } from "@/features/rooms/hooks/useRoomMeta";
import { useLocale } from "@/providers/LocaleProvider";
import type { AppMode } from "@/types/api";

const adminSettingsKey = ["admin", "settings"] as const;

export function useAdminSettings() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryFn: getAdminSettings,
    queryKey: adminSettingsKey
  });
  const updateMode = useMutation({
    mutationFn: (appMode: AppMode) =>
      updateAdminSettings({ app_mode: appMode }),
    onSuccess: (data) => {
      queryClient.setQueryData(adminSettingsKey, data);
      queryClient.setQueryData(roomQueryKeys.settings, data);
      void queryClient.invalidateQueries({ queryKey: adminSettingsKey });
      void queryClient.invalidateQueries({ queryKey: roomQueryKeys.settings });
      toast.success(t("admin.applicationModeUpdated"));
    }
  });

  return {
    appMode: settings.data?.app_mode,
    isLoading: settings.isLoading,
    isUpdating: updateMode.isPending,
    setAppMode: updateMode.mutate,
    error: settings.error ?? updateMode.error
  };
}
