import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:8080"),
  NEXT_PUBLIC_WS_URL: z.string().url().default("ws://localhost:8080/ws"),
  NEXT_PUBLIC_TURN_PUBLIC_IP: z.string().optional()
});

export const publicEnv = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_TURN_PUBLIC_IP: process.env.NEXT_PUBLIC_TURN_PUBLIC_IP
});

export type PublicEnv = typeof publicEnv;
