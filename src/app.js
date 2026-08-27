import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { createDatabasePool } from './config/database.js';
import { openApiDocument } from './docs/openapi.js';
import { authenticate } from './middlewares/auth.js';
import { errorHandler, notFoundHandler } from './middlewares/errors.js';
import { requestLogger } from './middlewares/request-logger.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createNotificationService } from './modules/notifications/notification.service.js';
import { createTaskRouter } from './modules/tasks/task.routes.js';
import { createTaskService } from './modules/tasks/task.service.js';
import { createUserRouter } from './modules/users/user.routes.js';

function corsOptions(allowedOrigins) {
  if (allowedOrigins === '*') return { origin: '*' };
  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  };
}

export function createApp({
  config,
  pool = createDatabasePool(config.database),
  fetchImpl,
  sleep,
}) {
  const app = express();
  const authenticateRequest = authenticate(pool, config.jwt);
  const notificationService = createNotificationService({
    pool,
    config: config.notification,
    fetchImpl,
    sleep,
  });
  const taskService = createTaskService(notificationService);

  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors(corsOptions(config.corsOrigins)));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ data: { status: 'ok' } });
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use(
    '/auth',
    createAuthRouter({ pool, jwtConfig: config.jwt, authenticate: authenticateRequest }),
  );
  app.use('/users', createUserRouter({ pool, authenticate: authenticateRequest }));
  app.use('/tasks', createTaskRouter({ pool, authenticate: authenticateRequest, taskService }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, pool };
}
