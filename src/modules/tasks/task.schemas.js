import { z } from 'zod';

const positiveId = z.coerce.number().int().positive();
const uniqueUserIds = z
  .array(positiveId)
  .min(1)
  .max(100)
  .refine((values) => new Set(values).size === values.length, 'userIds must be unique.');

export const taskIdParamsSchema = z.object({ idTask: positiveId }).strict();

export const createTaskBodySchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(10000).nullable().optional(),
    userIds: uniqueUserIds.optional(),
  })
  .strict();

export const assignTaskBodySchema = z.object({ userIds: uniqueUserIds }).strict();

export const completeTaskBodySchema = z.object({ userId: positiveId }).strict();

export const listTasksQuerySchema = z
  .object({ status: z.enum(['open', 'archived']).optional() })
  .strict();
