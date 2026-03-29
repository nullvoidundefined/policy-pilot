import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';

function createApp(max: number) {
  const app = express();

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'RATE_LIMITED',
      message: 'Too many requests, please try again later',
    },
  });

  app.use(limiter);
  app.get('/test', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

describe('Rate limiter middleware', () => {
  describe('under limit', () => {
    it('allows requests under the limit and includes rate limit headers', async () => {
      const app = createApp(5);
      const res = await request(app).get('/test');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(res.headers['ratelimit-limit']).toBe('5');
      expect(res.headers['ratelimit-remaining']).toBe('4');
    });
  });

  describe('over limit', () => {
    it('returns 429 with structured error after exceeding the limit', async () => {
      const app = createApp(2);

      // Exhaust the limit
      await request(app).get('/test');
      await request(app).get('/test');

      // This request should be rate limited
      const res = await request(app).get('/test');

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        error: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
      });
    });
  });

  describe('rate limit headers', () => {
    it('decrements remaining count with each request', async () => {
      const app = createApp(3);

      const res1 = await request(app).get('/test');
      expect(res1.headers['ratelimit-remaining']).toBe('2');

      const res2 = await request(app).get('/test');
      expect(res2.headers['ratelimit-remaining']).toBe('1');

      const res3 = await request(app).get('/test');
      expect(res3.headers['ratelimit-remaining']).toBe('0');
    });
  });
});
