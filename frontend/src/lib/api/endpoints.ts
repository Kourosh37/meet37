const encodePathSegment = (value: string) => encodeURIComponent(value);

export const endpoints = {
  health: "/health",
  settings: "/api/settings",
  auth: {
    login: "/api/auth/login",
    refresh: "/api/auth/refresh",
    logout: "/api/auth/logout",
    register: "/api/auth/register"
  },
  rooms: {
    base: "/api/rooms",
    byId: (roomId: string) => `/api/rooms/${encodePathSegment(roomId)}`,
    chat: (roomId: string) => `/api/rooms/${encodePathSegment(roomId)}/chat`,
    files: (roomId: string) => `/api/rooms/${encodePathSegment(roomId)}/files`
  },
  admin: {
    analytics: (range: string) =>
      `/api/admin/analytics?range=${encodeURIComponent(range)}`,
    settings: "/api/admin/settings",
    serverStatus: "/api/admin/server/status",
    users: "/api/admin/users",
    user: (userId: string) => `/api/admin/users/${encodePathSegment(userId)}`,
    roomDetail: (roomId: string) =>
      `/api/admin/rooms/${encodePathSegment(roomId)}/detail`,
    roomStats: (roomId: string) =>
      `/api/admin/rooms/${encodePathSegment(roomId)}/stats`,
    sfuStats: "/api/admin/sfu/stats"
  }
} as const;
