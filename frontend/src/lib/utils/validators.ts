import { z } from "zod";

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "validation.displayNameRequired")
  .max(80, "validation.displayNameTooLong");

export const roomPasswordSchema = z
  .string()
  .max(256, "validation.passwordTooLong")
  .optional();

export const loginSchema = z.object({
  username: z.string().trim().min(1, "validation.usernameRequired"),
  password: z.string().min(1, "validation.passwordRequired")
});

export const roomCreationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "validation.roomNameRequired")
    .max(120, "validation.roomNameTooLong"),
  room_id: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{3}-[a-z]{3}-[a-z]{3}$/, "validation.roomIdFormat")
    .optional()
    .or(z.literal("")),
  password: z.string().max(256, "validation.passwordTooLong").optional(),
  join_policy: z.enum(["open", "approval"]).default("open"),
  max_peers: z.coerce.number().int().min(2).max(500).default(50),
  expires_in: z.coerce.number().int().min(0).default(0)
});

export const adminUserCreateSchema = z.object({
  username: z.string().trim().min(3, "validation.usernameTooShort"),
  password: z.string().min(8, "validation.passwordTooShort")
});

export const adminUserUpdateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "validation.usernameTooShort")
      .optional(),
    password: z
      .string()
      .min(8, "validation.passwordTooShort")
      .optional()
  })
  .refine(
    (value) => value.username !== undefined || value.password !== undefined,
    {
      message: "validation.atLeastOneFieldChanged"
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
