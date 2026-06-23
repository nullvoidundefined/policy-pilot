/**
 * Auth-gate middleware: blocks requests that loadSession did not authenticate by
 * forwarding an unauthorized error, otherwise passes through to the route handler.
 */
import { ApiError } from 'app/errors/ApiError.js';
import type { NextFunction, Request, Response } from 'express';

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    next(ApiError.unauthorized());
    return;
  }
  next();
}
