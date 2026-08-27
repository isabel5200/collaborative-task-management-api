import { z } from 'zod';

const positiveId = z.coerce.number().int().positive();

export const createUserBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(100),
    email: z
      .email()
      .trim()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(72),
    role: z.enum(['ADMIN', 'MEMBER']),
  })
  .strict();

export const userIdParamsSchema = z.object({ userId: positiveId }).strict();
