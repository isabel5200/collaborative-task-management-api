import { Router } from 'express';
import { AppError } from '../../common/errors.js';
import { asyncHandler } from '../../common/async-handler.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { createUserBodySchema, userIdParamsSchema } from './user.schemas.js';
import * as userService from './user.service.js';

export function createUserRouter({ pool, authenticate }) {
  const router = Router();
  router.use(authenticate);

  router.post(
    '/',
    requireRole('ADMIN'),
    validate({ body: createUserBodySchema }),
    async (req, res) => {
      const user = await userService.createUser(
        pool,
        req.validated.body
      );

      return res.status(201).json({ data: user });
    },
  );

  router.get(
    '/',
    requireRole('ADMIN'),
    asyncHandler(async (_req, res) => {
      res.json({ data: { users: await userService.listUsers(pool) } });
    }),
  );

  router.get(
    '/:userId/tasks',
    validate({ params: userIdParamsSchema }),
    asyncHandler(async (req, res) => {
      const { userId } = req.validated.params;
      const tasks = await userService.getUserTasks(
        pool,
        userId
      );

      if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
        throw new AppError(403, 'FORBIDDEN', 'Members can only retrieve their own tasks.');
      }

      res.status(200).json({ data: tasks });
    }),
  );

  return router;
}
