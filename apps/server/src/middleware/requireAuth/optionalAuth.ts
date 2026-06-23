/**
 * Pass-through auth marker for routes where authentication is optional: relies on
 * loadSession having already hydrated req.user and never blocks the request.
 */
import type { NextFunction, Request, Response } from 'express';

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next();
}
