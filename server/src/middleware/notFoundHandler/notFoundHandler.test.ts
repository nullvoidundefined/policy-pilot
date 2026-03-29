import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { notFoundHandler } from './notFoundHandler.js';

function createApp() {
  const app = express();
  app.get('/exists', (_req, res) => res.json({ ok: true }));
  app.use(notFoundHandler);
  return app;
}

describe('notFoundHandler middleware', () => {
  it('returns 404 for unknown routes', async () => {
    const app = createApp();
    const res = await request(app).get('/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: 'Not found' } });
  });

  it('does not intercept existing routes', async () => {
    const app = createApp();
    const res = await request(app).get('/exists');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
