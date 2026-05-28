/*
Frontend architecture note

File: src\lib\utils\formatters.ts
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

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto"
});

export function formatUnixSeconds(value: number) {
  return dateTimeFormatter.format(new Date(value * 1000));
}

export function formatRelativeUnixSeconds(value: number, now = Date.now()) {
  const diffSeconds = Math.round((value * 1000 - now) / 1000);
  const abs = Math.abs(diffSeconds);

  if (abs < 60) {
    return relativeTimeFormatter.format(diffSeconds, "second");
  }

  if (abs < 3_600) {
    return relativeTimeFormatter.format(Math.round(diffSeconds / 60), "minute");
  }

  if (abs < 86_400) {
    return relativeTimeFormatter.format(Math.round(diffSeconds / 3_600), "hour");
  }

  return relativeTimeFormatter.format(Math.round(diffSeconds / 86_400), "day");
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const fractionDigits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
}

export function isUnixSecondsExpired(value: number, skewSeconds = 30) {
  return value * 1000 <= Date.now() + skewSeconds * 1000;
}
