import type { NextFunction, Request, Response } from 'express';

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export function csrfGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!STATE_CHANGING_METHODS.includes(req.method)) {
    next();
    return;
  }
  const value = req.get('X-Requested-With');
  if (!value) {
    res
      .status(403)
      .json({ error: { message: 'Missing X-Requested-With header' } });
    return;
  }
  next();
}
