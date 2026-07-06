import { createRoom } from "@/features/rooms/api/roomsApi";
import { getAuthSession, saveHostToken } from "@/lib/storage/tokenStorage";
import type { CreateRoomRequest } from "@/types/api";
import { useMutation } from "@tanstack/react-query";

export function useCreateRoom() {
  return useMutation({
    mutationFn: (request: CreateRoomRequest) =>
      createRoom(request, getAuthSession() !== null),
    onSuccess: (response) => {
      saveHostToken(response.room.id, response.host_token);
    }
  });
}
