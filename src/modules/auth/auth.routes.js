import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { loginBodySchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

export function createAuthRouter({ pool, jwtConfig, authenticate }) {
  const router = Router();

  router.post('/login', validate({ body: loginBodySchema }), async (req, res) => {
    const data = await authService.login(pool, req.validated.body, jwtConfig);

    return res.status(200).json({ data });
  });

  router.get('/me', authenticate, (req, res) => {
    res.json({ data: { user: authService.publicUser(req.user) } });
  });

  return router;
}
