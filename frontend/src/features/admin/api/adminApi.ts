import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  AdminSettingsResponse,
  AdminSfuStatsResponse,
  AdminUser,
  CreateAdminUserRequest,
  LiveRoomStats,
  Room,
  UpdateAdminSettingsRequest,
  UpdateAdminUserRequest
} from "@/types/api";

export function getAdminSettings() {
  return apiRequest<AdminSettingsResponse>(endpoints.admin.settings, {
    protected: true,
    retryOnUnauthorized: true
  });
}

export function updateAdminSettings(request: UpdateAdminSettingsRequest) {
  return apiRequest<AdminSettingsResponse, UpdateAdminSettingsRequest>(
    endpoints.admin.settings,
    {
      body: request,
      method: "PUT",
      protected: true,
      retryOnUnauthorized: true
    }
  );
}

export function listAdminUsers() {
  return apiRequest<AdminUser[]>(endpoints.admin.users, {
    protected: true,
    retryOnUnauthorized: true
  });
}

export function createAdminUser(request: CreateAdminUserRequest) {
  return apiRequest<AdminUser, CreateAdminUserRequest>(endpoints.admin.users, {
    body: request,
    method: "POST",
    protected: true,
    retryOnUnauthorized: true
  });
}

export function updateAdminUser(
  userId: string,
  request: UpdateAdminUserRequest
) {
  return apiRequest<void, UpdateAdminUserRequest>(
    endpoints.admin.user(userId),
    {
      body: request,
      method: "PUT",
      protected: true,
      retryOnUnauthorized: true
    }
  );
}

export function deleteAdminUser(userId: string) {
  return apiRequest<void>(endpoints.admin.user(userId), {
    method: "DELETE",
    protected: true,
    retryOnUnauthorized: true
  });
}

export function listAdminRooms() {
  return apiRequest<Room[]>(endpoints.rooms.base, {
    protected: true,
    retryOnUnauthorized: true
  });
}

export function getAdminRoomStats(roomId: string) {
  return apiRequest<LiveRoomStats>(endpoints.admin.roomStats(roomId), {
    protected: true,
    retryOnUnauthorized: true
  });
}

export function getAdminSfuStats() {
  return apiRequest<AdminSfuStatsResponse>(endpoints.admin.sfuStats, {
    protected: true,
    retryOnUnauthorized: true
  });
}
