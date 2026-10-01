import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('4000')
    .transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/moneysaver'),
  TEST_MONGODB_URI: z.string().default('mongodb://127.0.0.1:27018/moneysaver_test'),
  JWT_SECRET: z.string().default('moneysaver-jwt-super-secret-key-32-chars-long!'),
  JWT_REFRESH_SECRET: z.string().default('moneysaver-refresh-token-secret-key-32-chars-long!'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CORS_ORIGIN: z.string().default('*')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Environment configuration validation failed');
}

export const env = parsedEnv.data;
