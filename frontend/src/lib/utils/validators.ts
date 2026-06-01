/*
Frontend architecture note

File: src\lib\utils\validators.ts
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

import { z } from "zod";

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required")
  .max(80, "Display name is too long");

export const roomPasswordSchema = z
  .string()
  .max(256, "Password is too long")
  .optional();

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

export const roomCreationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Room name is required")
    .max(120, "Room name is too long"),
  password: z.string().max(256, "Password is too long").optional(),
  join_policy: z.enum(["open", "approval"]).default("open"),
  max_peers: z.coerce.number().int().min(2).max(500).default(50),
  expires_in: z.coerce.number().int().min(0).default(0)
});

export const adminUserCreateSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

export const adminUserUpdateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .optional()
  })
  .refine(
    (value) => value.username !== undefined || value.password !== undefined,
    {
      message: "At least one field must be changed"
    }
  );

export const filePolicySchema = z.object({
  size: z
    .number()
    .int()
    .min(1)
    .max(500 * 1024 * 1024),
  name: z.string().trim().min(1).max(255),
  mime: z.string().max(255).optional()
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RoomCreationFormValues = z.infer<typeof roomCreationSchema>;
export type AdminUserCreateValues = z.infer<typeof adminUserCreateSchema>;
export type AdminUserUpdateValues = z.infer<typeof adminUserUpdateSchema>;
