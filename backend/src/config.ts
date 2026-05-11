import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  PORT: z.preprocess((value) => (value === undefined ? 8080 : Number(value)), z.number().int().positive()),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_API_URL: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().optional().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  S3_PUBLIC_BASE_URL: z.string().optional(),
});

export const config = EnvSchema.parse(process.env);
export type AppConfig = z.infer<typeof EnvSchema>;
