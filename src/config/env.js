import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().regex(/^[A-Za-z0-9_]+$/),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().min(2).default('1h'),
  NOTIFY_URL: z.url(),
  NOTIFY_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(3000),
  CORS_ORIGIN: z.string().min(1).default('*'),
});

export function loadConfig(overrides = {}) {
  const parsed = environmentSchema.safeParse({ ...process.env, ...overrides });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const env = parsed.data;
  return {
    env: env.NODE_ENV,
    port: env.PORT,
    database: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      name: env.DB_NAME,
      connectionLimit: env.DB_CONNECTION_LIMIT,
    },
    jwt: {
      secret: env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
    },
    notification: {
      url: env.NOTIFY_URL,
      timeoutMs: env.NOTIFY_TIMEOUT_MS,
      retryBaseMs: env.NOTIFY_RETRY_BASE_MS,
    },
    corsOrigins:
      env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  };
}
