import { AppError } from '../common/errors.js';

export function notFoundHandler(req, _res, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} was not found.`));
}

export function errorHandler(error, _req, res, _next) {
  void _next;
  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Request body must contain valid JSON.' },
    });
  }

  console.error(
    JSON.stringify({
      level: 'error',
      message: error?.message || 'Unexpected error',
      code: error?.code,
    }),
  );
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
}
