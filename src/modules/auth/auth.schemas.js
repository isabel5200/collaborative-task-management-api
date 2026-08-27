import { z } from 'zod';

export const loginBodySchema = z
  .object({
    email: z
      .email()
      .trim()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(72),
  })
  .strict();
