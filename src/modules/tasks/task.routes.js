import { Router } from 'express';
import { asyncHandler } from '../../common/async-handler.js';
import { idempotentPost } from '../../middlewares/idempotent-post.js';
import { requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  assignTaskBodySchema,
  completeTaskBodySchema,
  createTaskBodySchema,
  listTasksQuerySchema,
  taskIdParamsSchema,
} from './task.schemas.js';

export function createTaskRouter({ pool, authenticate, taskService }) {
  const router = Router();
  router.use(authenticate);

  router.post(
    '/',
    requireRole('ADMIN'),
    validate({ body: createTaskBodySchema }),
    idempotentPost(pool, async (req, connection) => ({
      status: 201,
      body: {
        message: 'Task created successfully.',
        data: {
          task: await taskService.createTask(connection, req.validated.body, req.user.id),
        },
      },
    })),
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
    idempotentPost(pool, async (req, connection) => ({
      status: 200,
      body: {
        message: 'Users assigned successfully.',
        data: {
          task: await taskService.assignTask(
            connection,
            req.validated.params.idTask,
            req.validated.body.userIds,
          ),
        },
      },
    })),
  );

  router.post(
    '/:idTask/complete',
    requireRole('MEMBER'),
    validate({ params: taskIdParamsSchema, body: completeTaskBodySchema }),
    idempotentPost(pool, async (req, connection) => {
      const completion = await taskService.completeTask(
        connection,
        req.validated.params.idTask,
        req.user.id,
        req.validated.body.userId,
      );
      return {
        status: 200,
        body: {
          message: completion.result.alreadyCompleted
            ? 'Assignment was already completed.'
            : 'Assignment completed successfully.',
          data: completion.result,
        },
        afterCommit: completion.afterCommit,
      };
    }),
  );

  router.get(
    '/:idTask/notifications',
    requireRole('ADMIN'),
    validate({ params: taskIdParamsSchema }),
    asyncHandler(async (req, res) => {
      const notifications = await taskService.listNotifications(pool, req.validated.params.idTask);

      res.status(200).json({ data: notifications });
    }),
  );

  router.get(
    '/:idTask',
    validate({ params: taskIdParamsSchema }),
    asyncHandler(async (req, res) => {
      const { idTask } = req.validated.params;
      const task = await taskService.getTask(pool, idTask);

      await taskService.assertTaskAccess(pool, idTask, req.user);

      res.status(200).json({ data: { task } });
    }),
  );

  return router;
}
