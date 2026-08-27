import { AppError } from '../common/errors.js';

export function validate(schemas) {
  return function validationMiddleware(req, _res, next) {
    req.validated = req.validated ?? {};

    for (const [source, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[source]);

      if (!result.success) {
        const message = result.error.issues
          .map((issue) => {
            const location = issue.path.length ? issue.path.join('.') : source;

            return `${location}: ${issue.message}`;
          })
          .join('; ');

        return next(new AppError(400, 'VALIDATION_ERROR', message));
      }

      req.validated[source] = result.data;
    }

    return next();
  };
}
