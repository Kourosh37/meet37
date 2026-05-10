const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export interface JoinRoomResponse {
  livekitToken: string;
}

export interface UploadUrlResponse {
  fileId: string;
  uploadUrl: string;
  downloadUrl: string;
}

class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // fallback to default error message
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function createRoom(): Promise<string> {
  const body = await request<{ token: string }>('/rooms', { method: 'POST' });
  return body.token;
}

export async function validateRoom(token: string): Promise<boolean> {
  try {
    const body = await request<{ exists: boolean }>(`/rooms/${encodeURIComponent(token)}`);
    return body.exists;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return false;
    }

    throw error;
  }
}

export async function joinRoom(token: string, displayName: string): Promise<JoinRoomResponse> {
  return request<JoinRoomResponse>(`/rooms/${encodeURIComponent(token)}/join`, {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
}

export async function getUploadUrl(filename: string, size: number): Promise<UploadUrlResponse> {
  return request<UploadUrlResponse>('/files/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename, size }),
  });
}

export function getLiveKitUrl(): string {
  return import.meta.env.VITE_LK_URL ?? 'ws://localhost:7880';
}
