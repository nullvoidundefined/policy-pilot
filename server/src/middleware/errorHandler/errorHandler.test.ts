import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

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

import { errorHandler } from './errorHandler.js';

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
    expect(res.body.error.message).toBe('Something broke');

    process.env.NODE_ENV = original;
  });

  it('returns generic message in production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const app = createApp(new Error('Secret details'));
    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Internal server error');

    process.env.NODE_ENV = original;
  });

  it('handles non-Error thrown values', async () => {
    const app = createApp('string error');
    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
  });
});
