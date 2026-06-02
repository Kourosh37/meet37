import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  AdminSettingsResponse,
  ChatHistoryItem,
  CreateRoomRequest,
  CreateRoomResponse,
  FileHistoryItem,
  Room,
  RoomDetailsResponse
} from "@/types/api";

export function getPublicSettings() {
  return apiRequest<AdminSettingsResponse>(endpoints.settings);
}

export function listRooms() {
  return apiRequest<Room[]>(endpoints.rooms.base);
}

export function createRoom(
  request: CreateRoomRequest,
  protectedRequest = false
) {
  return apiRequest<CreateRoomResponse, CreateRoomRequest>(
    endpoints.rooms.base,
    {
      body: request,
      method: "POST",
      protected: protectedRequest,
      retryOnUnauthorized: false
    }
  );
}

export function getRoom(roomId: string) {
  return apiRequest<RoomDetailsResponse>(endpoints.rooms.byId(roomId));
}

export function deleteRoom(roomId: string) {
  return apiRequest<void>(endpoints.rooms.byId(roomId), {
    method: "DELETE",
    protected: true,
    retryOnUnauthorized: true
  });
}

export function getRoomChat(roomId: string) {
  return apiRequest<ChatHistoryItem[]>(endpoints.rooms.chat(roomId));
}

export function getRoomFiles(roomId: string) {
  return apiRequest<FileHistoryItem[]>(endpoints.rooms.files(roomId));
}
