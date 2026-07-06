import { getPublicSettings, getRoom } from "@/features/rooms/api/roomsApi";
import { useQuery } from "@tanstack/react-query";

export const roomQueryKeys = {
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

export function useRoomMeta(roomId: string) {
  return useQuery({
    enabled: roomId.length > 0,
    queryFn: () => getRoom(roomId),
    queryKey: roomQueryKeys.detail(roomId),
    staleTime: 10_000
  });
}
