import { app } from 'app/app.js';
import type { Server } from 'http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_EMAIL = 'auth-flow@integration-test.invalid';
const TEST_PASSWORD = 'testpassword123';

describe('Auth Integration', () => {
  let server: Server;
  let csrfToken: string;
  let csrfCookie: string;
  let sessionCookie: string;

  beforeAll(() => {
    server = app.listen(0); // random available port
  });

  afterAll(() => {
    server?.close();
  });

  it('GET /api/csrf-token returns a token', async () => {
    const res = await request(server).get('/api/csrf-token');
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    csrfToken = res.body.token;
    csrfCookie =
      (res.headers['set-cookie'] as unknown as string[])?.find((c) =>
        c.startsWith('__csrf'),
      ) ?? '';
    expect(csrfCookie).not.toBe('');
  });

  it('POST /auth/register creates a user and returns session', async () => {
    const res = await request(server)
      .post('/auth/register')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        first_name: 'Auth',
        last_name: 'Test',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.user.id).toBeDefined();

    sessionCookie =
      (res.headers['set-cookie'] as unknown as string[])?.find((c) =>
        c.startsWith('sid'),
      ) ?? '';
    expect(sessionCookie).not.toBe('');
  });

  it('GET /auth/me returns authenticated user', async () => {
    const res = await request(server)
      .get('/auth/me')
      .set('Cookie', [csrfCookie, sessionCookie].join('; '))
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
  });

  it('POST /auth/logout clears session', async () => {
    const tokenRes = await request(server)
      .get('/api/csrf-token')
      .set('Cookie', [csrfCookie, sessionCookie].join('; '));
    const logoutCsrf = tokenRes.body.token;
    const logoutCsrfCookie =
      (tokenRes.headers['set-cookie'] as unknown as string[])?.find((c) =>
        c.startsWith('__csrf'),
      ) ?? csrfCookie;

    const res = await request(server)
      .post('/auth/logout')
      .set('Cookie', [logoutCsrfCookie, sessionCookie].join('; '))
      .set('X-CSRF-Token', logoutCsrf)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(204);
  });

  it('GET /auth/me after logout returns 401', async () => {
    const res = await request(server)
      .get('/auth/me')
      .set('Cookie', sessionCookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(401);
  });

  it('POST /auth/login with valid creds returns session', async () => {
    const tokenRes = await request(server).get('/api/csrf-token');
    const loginCsrf = tokenRes.body.token;
    const loginCsrfCookie =
      (tokenRes.headers['set-cookie'] as unknown as string[])?.find((c) =>
        c.startsWith('__csrf'),
      ) ?? '';

    const res = await request(server)
      .post('/auth/login')
      .set('Cookie', loginCsrfCookie)
      .set('X-CSRF-Token', loginCsrf)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
  });

  it('POST /auth/login with bad creds returns 401', async () => {
    const tokenRes = await request(server).get('/api/csrf-token');
    const badCsrf = tokenRes.body.token;
    const badCsrfCookie =
      (tokenRes.headers['set-cookie'] as unknown as string[])?.find((c) =>
        c.startsWith('__csrf'),
      ) ?? '';

    const res = await request(server)
      .post('/auth/login')
      .set('Cookie', badCsrfCookie)
      .set('X-CSRF-Token', badCsrf)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: TEST_EMAIL, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('POST /auth/login without CSRF token is rejected', async () => {
    const res = await request(server)
      .post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    // csrf-csrf throws ForbiddenError which the error handler maps to 500
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).not.toBe(200);
  });

  it('POST /auth/register with duplicate email returns 409', async () => {
    const tokenRes = await request(server).get('/api/csrf-token');
    const dupCsrf = tokenRes.body.token;
    const dupCsrfCookie =
      (tokenRes.headers['set-cookie'] as unknown as string[])?.find((c) =>
        c.startsWith('__csrf'),
      ) ?? '';

    const res = await request(server)
      .post('/auth/register')
      .set('Cookie', dupCsrfCookie)
      .set('X-CSRF-Token', dupCsrf)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        first_name: 'Auth',
        last_name: 'Test',
      });

    expect(res.status).toBe(409);
  });
});
