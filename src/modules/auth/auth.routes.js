import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { idempotentPost } from '../../middlewares/idempotent-post.js';
import { loginBodySchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

export function createAuthRouter({ pool, jwtConfig, authenticate }) {
  const router = Router();

  router.post(
    '/login',
    validate({ body: loginBodySchema }),
    idempotentPost(pool, async (req, connection) => ({
      status: 200,
      body: { data: await authService.login(connection, req.validated.body, jwtConfig) },
    })),
  );

  router.get('/me', authenticate, (req, res) => {
    res.json({ data: { user: authService.publicUser(req.user) } });
  });

  return router;
}
