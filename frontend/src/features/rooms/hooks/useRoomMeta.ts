import {
  getPublicSettings,
  getRoom,
  listRooms
} from "@/features/rooms/api/roomsApi";
import { useQuery } from "@tanstack/react-query";

export const roomQueryKeys = {
  all: ["rooms"] as const,
  settings: ["settings"] as const,
  detail: (roomId: string) => ["rooms", roomId] as const
};

export function usePublicSettings() {
  return useQuery({
    queryFn: getPublicSettings,
    queryKey: roomQueryKeys.settings,
    staleTime: 0
  });
}

export function useRooms() {
  return useQuery({
    queryFn: listRooms,
    queryKey: roomQueryKeys.all,
    staleTime: 15_000
  });
}

export function useRoomMeta(roomId: string) {
  return useQuery({
    enabled: roomId.length > 0,
    queryFn: () => getRoom(roomId),
    queryKey: roomQueryKeys.detail(roomId),
    staleTime: 10_000
  });
}
