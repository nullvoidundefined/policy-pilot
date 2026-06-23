/**
 * Express catch-all handler that returns a 404 JSON response for any unmatched route,
 * providing a uniform not-found shape instead of Express's default HTML error page.
 */
import type { Request, Response } from 'express';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Not found' });
}
