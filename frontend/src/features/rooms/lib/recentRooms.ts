import type { Room } from "@/types/api";

const RECENT_ROOMS_KEY = "meet_recent_rooms";
const RECENT_ROOM_LIMIT = 7;

export interface RecentRoom {
  id: string;
  name: string;
  joinedAt: number;
  expiresAt?: number;
  hasPassword: boolean;
  joinPolicy: Room["join_policy"];
}

function isBrowser() {
  return typeof window !== "undefined";
}

function isRecentRoom(value: unknown): value is RecentRoom {
  if (!value || typeof value !== "object") {
    return false;
  }
  const room = value as Partial<RecentRoom>;
  return (
    typeof room.id === "string" &&
    /^[a-z]{3}-[a-z]{3}-[a-z]{3}$/.test(room.id) &&
    typeof room.name === "string" &&
    typeof room.joinedAt === "number"
  );
}

export function listRecentRooms(): RecentRoom[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(RECENT_ROOMS_KEY) ?? "[]"
    );
    return Array.isArray(parsed)
      ? parsed.filter(isRecentRoom).slice(0, RECENT_ROOM_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentRoom(room: Room) {
  if (!isBrowser()) {
    return;
  }

  const entry: RecentRoom = {
    expiresAt: room.expires_at,
    hasPassword: room.has_password,
    id: room.id,
    joinedAt: Date.now(),
    joinPolicy: room.join_policy,
    name: room.name
  };
  const rooms = [
    entry,
    ...listRecentRooms().filter((recent) => recent.id !== room.id)
  ].slice(0, RECENT_ROOM_LIMIT);
  window.localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(rooms));
}

export function removeRecentRoom(roomId: string) {
  if (!isBrowser()) {
    return;
  }

  const rooms = listRecentRooms().filter((room) => room.id !== roomId);
  window.localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(rooms));
}
