import { createRoom } from "@/features/rooms/api/roomsApi";
import { roomQueryKeys } from "@/features/rooms/hooks/useRoomMeta";
import { getAuthSession, saveHostToken } from "@/lib/storage/tokenStorage";
import type { CreateRoomRequest } from "@/types/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateRoomRequest) =>
      createRoom(request, getAuthSession() !== null),
    onSuccess: (response) => {
      saveHostToken(response.room.id, response.host_token);
      void queryClient.invalidateQueries({ queryKey: roomQueryKeys.all });
    }
  });
}
