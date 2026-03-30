import { ApiError } from 'app/utils/ApiError.js';
import { logger } from 'app/utils/logs/logger.js';
import type { NextFunction, Request, Response } from 'express';

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    logger.warn(
      { err, reqId: req.id, statusCode: err.statusCode, code: err.code },
      'API error in request handler',
    );

    const body: { error: string; message: string; details?: unknown } = {
      error: err.code,
      message: err.message,
    };
    if (err.details !== undefined) {
      body.details = err.details;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof Error && (err as HttpError).code === 'EBADCSRFTOKEN') {
    logger.warn({ reqId: req.id }, 'Invalid CSRF token');
    res
      .status(403)
      .json({ error: 'CSRF_ERROR', message: 'Invalid CSRF token' });
    return;
  }

  logger.error({ err, reqId: req.id }, 'Unhandled error in request handler');

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err instanceof Error
          ? err.message
          : 'Internal server error',
  });
}
