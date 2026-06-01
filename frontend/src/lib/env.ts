import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().default("http://localhost:8080"),
  NEXT_PUBLIC_WS_URL: z.string().default("ws://localhost:8080/ws"),
  NEXT_PUBLIC_TURN_PUBLIC_IP: z.string().optional()
});

const parsedEnv = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_TURN_PUBLIC_IP: process.env.NEXT_PUBLIC_TURN_PUBLIC_IP
});

function browserOrigin() {
  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }

  return window.location.origin;
}

function browserWebSocketUrl() {
  const origin = browserOrigin();

  if (origin.startsWith("https://")) {
    return origin.replace("https://", "wss://") + "/ws";
  }

  return origin.replace("http://", "ws://") + "/ws";
}

export const publicEnv = {
  ...parsedEnv,
  NEXT_PUBLIC_API_BASE_URL:
    parsedEnv.NEXT_PUBLIC_API_BASE_URL === "browser-origin"
      ? browserOrigin()
      : parsedEnv.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_WS_URL:
    parsedEnv.NEXT_PUBLIC_WS_URL === "browser-origin"
      ? browserWebSocketUrl()
      : parsedEnv.NEXT_PUBLIC_WS_URL
};

export type PublicEnv = typeof publicEnv;
