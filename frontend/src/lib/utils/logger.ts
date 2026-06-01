/*
Frontend architecture note

File: src\lib\utils\logger.ts
Layer: Frontend Foundation

Responsibility:
- Frontend file for the Frontend Foundation layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: keep this file aligned with backend/docs/API.md and backend/docs/WEBSOCKET.md when it touches server data or signaling.

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

type LogScope =
  | "api"
  | "auth"
  | "file"
  | "meeting"
  | "storage"
  | "webrtc"
  | "websocket";
type LogLevel = "debug" | "info" | "warn" | "error";

const sensitiveKeys = new Set([
  "access_token",
  "candidate",
  "credential",
  "host_token",
  "password",
  "refresh_token",
  "sdp",
  "token"
]);

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([key, nestedValue]) => [
          key,
          sensitiveKeys.has(key) ? "[redacted]" : redactValue(nestedValue)
        ]
      )
    );
  }

  return value;
}

function shouldLog(level: LogLevel) {
  return process.env.NODE_ENV !== "production" || level === "error";
}

export function createLogger(scope: LogScope) {
  function write(level: LogLevel, message: string, context?: unknown) {
    if (!shouldLog(level)) {
      return;
    }

    const payload = context === undefined ? [] : [redactValue(context)];
    console[level](`[${scope}] ${message}`, ...payload);
  }

  return {
    debug: (message: string, context?: unknown) =>
      write("debug", message, context),
    error: (message: string, context?: unknown) =>
      write("error", message, context),
    info: (message: string, context?: unknown) =>
      write("info", message, context),
    warn: (message: string, context?: unknown) =>
      write("warn", message, context)
  };
}

export const logger = createLogger("meeting");
