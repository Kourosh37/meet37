/*
Frontend architecture note

File: src\lib\api\client.ts
Layer: REST API Infrastructure

Responsibility:
- Shared HTTP client configuration for the backend REST API, including base URL, JSON headers, bearer token attachment, error normalization, and one-time refresh/retry behavior.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: all REST paths and response shapes must be sourced from backend/docs/API.md and normalized before reaching React components.

State model to plan: loading, ready, empty, recoverable error, fatal error, and cleanup/unmount behavior where applicable.

UX and edge cases to plan:
- Display clear loading and empty states instead of rendering nothing once implementation starts.
- Normalize backend errors into user-safe messages while preserving technical details for logger.ts.
- Keep room links shareable; never require global login just to open an existing meeting link.
- In private app mode, require login only for room creation, not for joining a shared room link.
- Every meeting participant must provide a non-empty display name before joining.

Security and privacy notes:
- Never expose refresh tokens to arbitrary components; use the storage/auth layer only.
- Treat host_token as room-scoped moderation authority and avoid leaking it into URLs or logs.
- Do not persist raw media streams, SDP blobs, ICE candidates, or file bytes unless a later backend feature explicitly requires it.

Future tests: success path, loading path, error path, accessibility expectations, and cleanup/side-effect boundaries.

*/

import { publicEnv } from "@/lib/env";
import { createLogger } from "@/lib/utils/logger";
import type { ApiErrorBody } from "@/types/api";

type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
type AccessTokenResolver = () => Promise<string | null> | string | null;
type UnauthorizedHandler = () => Promise<boolean> | boolean;

const apiLogger = createLogger("api");

let accessTokenResolver: AccessTokenResolver | undefined;
let unauthorizedHandler: UnauthorizedHandler | undefined;

export interface ApiRequestOptions<TBody = unknown> {
  body?: TBody;
  headers?: HeadersInit;
  method?: HttpMethod;
  protected?: boolean;
  retryOnUnauthorized?: boolean;
  signal?: AbortSignal;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function setAccessTokenResolver(
  resolver: AccessTokenResolver | undefined
) {
  accessTokenResolver = resolver;
}

export function setUnauthorizedHandler(
  handler: UnauthorizedHandler | undefined
) {
  unauthorizedHandler = handler;
}

function buildUrl(path: string) {
  return new URL(path, publicEnv.NEXT_PUBLIC_API_BASE_URL).toString();
}

async function parseResponse(response: Response) {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : undefined;
}

function errorMessageFromBody(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body) {
    return String((body as ApiErrorBody).error);
  }

  return fallback;
}

async function createHeaders(options: ApiRequestOptions) {
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.protected && accessTokenResolver) {
    const token = await accessTokenResolver();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return headers;
}

async function requestOnce<TResponse, TBody>(
  path: string,
  options: ApiRequestOptions<TBody>
) {
  const response = await fetch(buildUrl(path), {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: await createHeaders(options),
    method: options.method ?? "GET",
    signal: options.signal
  });

  const parsed = await parseResponse(response);

  if (!response.ok) {
    throw new ApiClientError(
      errorMessageFromBody(
        parsed,
        `Request failed with status ${response.status}`
      ),
      response.status,
      parsed
    );
  }

  return parsed as TResponse;
}

function shouldRetryUnauthorized(
  method: HttpMethod,
  enabled: boolean | undefined
) {
  if (enabled !== undefined) {
    return enabled;
  }

  return method === "GET";
}

export async function apiRequest<TResponse, TBody = unknown>(
  path: string,
  options: ApiRequestOptions<TBody> = {}
) {
  const method = options.method ?? "GET";

  try {
    return await requestOnce<TResponse, TBody>(path, { ...options, method });
  } catch (error) {
    if (
      error instanceof ApiClientError &&
      error.status === 401 &&
      unauthorizedHandler &&
      shouldRetryUnauthorized(method, options.retryOnUnauthorized)
    ) {
      const refreshed = await unauthorizedHandler();

      if (refreshed) {
        apiLogger.debug("Retrying request after unauthorized refresh", {
          method,
          path
        });
        return requestOnce<TResponse, TBody>(path, { ...options, method });
      }
    }

    throw error;
  }
}
