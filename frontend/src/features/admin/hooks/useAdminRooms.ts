"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import {
  getAdminAnalytics,
  getAdminRoomDetail,
  getAdminRoomStats,
  getAdminServerStatus,
  getAdminSfuStats,
  listAdminRooms
} from "@/features/admin/api/adminApi";
import type { AdminAnalyticsRange } from "@/types/api";

export function useAdminAnalytics(range: AdminAnalyticsRange) {
  return useQuery({
    queryFn: () => getAdminAnalytics(range),
    queryKey: ["admin", "analytics", range],
    refetchInterval: 30_000
  });
}

export function useAdminServerStatus() {
  return useQuery({
    queryFn: getAdminServerStatus,
    queryKey: ["admin", "server", "status"],
    refetchInterval: 3_000
  });
}

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

  const liveRooms = (rooms.data ?? [])
    .map((room, index) => ({
      room,
      stats: stats[index]?.data
    }))
    .filter(
      ({ stats: roomStats }) =>
        roomStats?.active === true && roomStats.peer_count > 0
    );
  const statsError = stats.find((query) => query.error)?.error;

  return {
    error: rooms.error ?? statsError,
    isLoading: rooms.isLoading || stats.some((query) => query.isLoading),
    rooms: liveRooms
  };
}

export function useAdminSfuStats() {
  return useQuery({
    queryFn: getAdminSfuStats,
    queryKey: ["admin", "sfu", "stats"],
    refetchInterval: 5_000
  });
}

export function useAdminRoomDetail(roomId?: string | null) {
  return useQuery({
    enabled: Boolean(roomId),
    queryFn: () => getAdminRoomDetail(roomId ?? ""),
    queryKey: ["admin", "rooms", roomId, "detail"],
    refetchInterval: 3_000
  });
}
