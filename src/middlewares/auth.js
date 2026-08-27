import jwt from 'jsonwebtoken';
import { AppError } from '../common/errors.js';
import { asyncHandler } from '../common/async-handler.js';
import * as userRepository from '../modules/users/user.repository.js';

export function authenticate(pool, jwtConfig) {
  return asyncHandler(async (req, _res, next) => {
    const authorization = req.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'A valid Bearer token is required.');
    }

    const token = authorization.slice('Bearer '.length).trim();
    let payload;

    try {
      payload = jwt.verify(token, jwtConfig.secret);
    } catch {
      throw new AppError(401, 'INVALID_TOKEN', 'The access token is invalid or expired.');
    }

    const user = await userRepository.findById(pool, Number(payload.sub));
    if (!user || !user.isActive) {
      throw new AppError(401, 'INVALID_TOKEN', 'The access token is no longer valid.');
    }

    req.user = user;

    next();
  });
}

export function requireRole(...allowedRoles) {
  return function roleMiddleware(req, _res, next) {
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission for this action.'));
    }

    return next();
  };
}
