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
