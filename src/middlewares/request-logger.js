import { randomUUID } from 'node:crypto';

export function requestLogger(req, res, next) {
  const startedAt = Date.now();
  const requestId = req.get('x-request-id') || randomUUID();
  res.set('X-Request-Id', requestId);

  res.on('finish', () => {
    console.info(
      JSON.stringify({
        level: 'info',
        requestId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      }),
    );
  });
  next();
}
