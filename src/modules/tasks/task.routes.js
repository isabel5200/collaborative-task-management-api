import { Router } from 'express';
import { asyncHandler } from '../../common/async-handler.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  assignTaskBodySchema,
  completeTaskBodySchema,
  createTaskBodySchema,
  listTasksQuerySchema,
  taskIdParamsSchema,
} from './task.schemas.js';
import { withTransaction } from '../../config/database.js';

export function createTaskRouter({ pool, authenticate, taskService }) {
  const router = Router();
  router.use(authenticate);

  router.post(
    '/',
    requireRole('ADMIN'),
    validate({ body: createTaskBodySchema }),
    async (req, res) => {
      const task = await withTransaction(
        pool,
        (connection) =>
          taskService.createTask(
            connection,
            req.validated.body,
            req.user.id
          )
      );

      return res.status(201).json({
        message: 'Task created successfully.',
        data: { data: task },
      });
    }
  );

  router.get(
    '/',
    requireRole('ADMIN'),
    validate({ query: listTasksQuerySchema }),
    asyncHandler(async (req, res) => {
      res.json({
        data: { tasks: await taskService.listTasks(pool, req.validated.query.status) },
      });
    }),
  );

  router.post(
    '/:idTask/assign',
    requireRole('ADMIN'),
    validate({ params: taskIdParamsSchema, body: assignTaskBodySchema }),
    async (req, res) => {
      const taskAssign = await taskService.assignTask(
        pool,
        req.validated.params.idTask,
        req.validated.body.userIds
      );

      return res.status(200).json({
        message: 'Users assigned successfully.',
        data: { data: taskAssign }
      });
    },
  );

  router.post(
    '/:idTask/complete',
    requireRole('MEMBER'),
    validate({ params: taskIdParamsSchema, body: completeTaskBodySchema }),
    async (req, res) => {
      const completion = await taskService.completeTask(
        pool,
        req.validated.params.idTask,
        req.user.id,
        req.validated.body.userId,
      );

      return res.status(200).json({
        message: completion.result.alreadyCompleted
          ? 'Assignment was already completed.'
          : 'Assignment completed successfully.',
        data: completion.result,
        afterCommit: completion.afterCommit,
      });
    }
  );

  router.get(
    '/:idTask/notifications',
    requireRole('ADMIN'),
    validate({ params: taskIdParamsSchema }),
    asyncHandler(async (req, res) => {
      res.json({
        data: {
          notifications: await taskService.listNotifications(pool, req.validated.params.idTask),
        },
      });
    }),
  );

  router.get(
    '/:idTask',
    validate({ params: taskIdParamsSchema }),
    asyncHandler(async (req, res) => {
      const { idTask } = req.validated.params;
      await taskService.assertTaskAccess(pool, idTask, req.user);
      res.json({ data: { task: await taskService.getTask(pool, idTask) } });
    }),
  );

  return router;
}
