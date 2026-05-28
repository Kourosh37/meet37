"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import {
  getAdminRoomStats,
  getAdminSfuStats,
  listAdminRooms
} from "@/features/admin/api/adminApi";

export function useAdminRooms() {
  const rooms = useQuery({
    queryFn: listAdminRooms,
    queryKey: ["admin", "rooms"],
    refetchInterval: 10_000
  });
  const stats = useQueries({
    queries: (rooms.data ?? []).map((room) => ({
      enabled: Boolean(rooms.data),
      queryFn: () => getAdminRoomStats(room.id),
      queryKey: ["admin", "rooms", room.id, "stats"],
      refetchInterval: 5_000
    }))
  });

  return {
    error: rooms.error,
    isLoading: rooms.isLoading,
    rooms: (rooms.data ?? []).map((room, index) => ({
      room,
      stats: stats[index]?.data
    }))
  };
}

export function useAdminSfuStats() {
  return useQuery({
    queryFn: getAdminSfuStats,
    queryKey: ["admin", "sfu", "stats"],
    refetchInterval: 5_000
  });
}
