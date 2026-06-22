import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const TEST_SECRET = 'test-csrf-secret-value';

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => TEST_SECRET,
  getSessionIdentifier: (req) => (req as express.Request).cookies?.sid ?? '',
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: false,
  },
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Token endpoint — placed BEFORE the CSRF middleware
  app.get('/api/csrf-token', (req, res) => {
    const token = generateCsrfToken(req, res);
    res.json({ token });
  });

  app.use(doubleCsrfProtection);

  app.post('/test', (_req, res) => {
    res.json({ ok: true });
  });

  app.delete('/test', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/test', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

describe('CSRF protection', () => {
  let app: express.Express;

  beforeAll(() => {
    app = createApp();
  });

  it('GET /api/csrf-token returns a token', async () => {
    const res = await request(app).get('/api/csrf-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
  });

  it('POST without CSRF token returns 403', async () => {
    const res = await request(app).post('/test').send({ data: 'hello' });
    expect(res.status).toBe(403);
  });

  it('DELETE without CSRF token returns 403', async () => {
    const res = await request(app).delete('/test');
    expect(res.status).toBe(403);
  });

  it('POST with valid CSRF token returns 200', async () => {
    // First, get a CSRF token (this also sets the cookie)
    const tokenRes = await request(app).get('/api/csrf-token');
    const token = tokenRes.body.token as string;

    // Extract the __csrf cookie from the response
    const cookies = tokenRes.headers['set-cookie'] as string[] | undefined;
    const csrfCookie = cookies?.find((c: string) => c.startsWith('__csrf='));
    expect(csrfCookie).toBeDefined();

    // Use the token + cookie on a POST request
    const res = await request(app)
      .post('/test')
      .set('Cookie', csrfCookie!)
      .set('x-csrf-token', token)
      .send({ data: 'hello' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
