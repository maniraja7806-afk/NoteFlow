import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError';

/**
 * Collects express-validator results and throws a 400 if any check failed.
 */
export function validate(req: Request, _res: Response, next: NextFunction): void {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const details = result.array().map((e) => ({
      field: 'path' in e ? e.path : undefined,
      message: e.msg,
    }));
    return next(ApiError.badRequest('Validation failed', details));
  }
  return next();
}
