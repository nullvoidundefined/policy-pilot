/**
 * Session-hydration middleware: resolves the session cookie to a user record and
 * attaches it to the request, passing through unauthenticated when no valid session exists.
 */
import { SESSION_COOKIE_NAME } from 'app/constants/session.js';
import * as authRepo from 'app/repositories/auth/index.js';
import type { NextFunction, Request, Response } from 'express';

export async function loadSession(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token || typeof token !== 'string') {
    next();
    return;
  }
  try {
    const user = await authRepo.getSessionWithUser(token);
    if (user) req.user = user;
  } catch (err) {
    next(err);
    return;
  }
  next();
}
