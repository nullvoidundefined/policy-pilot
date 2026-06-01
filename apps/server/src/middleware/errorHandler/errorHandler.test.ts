import { ApiError } from 'app/utils/ApiError.js';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from './errorHandler.js';

vi.mock('app/utils/logs/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

function createApp(error: unknown) {
  const app = express();

  app.get('/test', () => {
    throw error;
  });

  app.use(errorHandler);
  return app;
}

describe('errorHandler middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 500 with error message in non-production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const app = createApp(new Error('Something broke'));
    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INTERNAL_ERROR');
    expect(res.body.message).toBe('Something broke');

    process.env.NODE_ENV = original;
  });

  it('returns generic message in production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const app = createApp(new Error('Secret details'));
    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INTERNAL_ERROR');
    expect(res.body.message).toBe('Internal server error');

    process.env.NODE_ENV = original;
  });

  it('handles non-Error thrown values', async () => {
    const app = createApp('string error');
    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INTERNAL_ERROR');
  });

  it('handles ApiError with correct status and code', async () => {
    const app = createApp(ApiError.badRequest('Invalid input'));
    const res = await request(app).get('/test');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'Invalid input',
    });
  });

  it('handles ApiError with details', async () => {
    const app = createApp(
      ApiError.badRequest('Validation failed', { field: 'email' }),
    );
    const res = await request(app).get('/test');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: { field: 'email' },
    });
  });

  it('handles ApiError.notFound', async () => {
    const app = createApp(ApiError.notFound('Document not found'));
    const res = await request(app).get('/test');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'NOT_FOUND',
      message: 'Document not found',
    });
  });
});
