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
