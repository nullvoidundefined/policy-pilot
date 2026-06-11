import { app } from 'app/app.js';
import type { Server } from 'http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('GET /collections/:id/documents', () => {
  let server: Server;

  beforeAll(() => {
    server = app.listen(0);
  });

  afterAll(() => {
    server?.close();
  });

  it('returns documents array for a user-owned collection', async () => {
    const email = `col-docs-${Date.now()}@integration-test.invalid`;

    const csrfRes = await request(server).get('/api/csrf-token');
    const csrfToken = csrfRes.body.token as string;
    const csrfCookie =
      (csrfRes.headers['set-cookie'] as unknown as string[])?.find((c) =>
        c.startsWith('__csrf'),
      ) ?? '';

    const registerRes = await request(server)
      .post('/auth/register')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email,
        password: 'password123',
        first_name: 'T',
        last_name: 'T',
      });
    expect(registerRes.status).toBe(201);

    const sessionCookie =
      (registerRes.headers['set-cookie'] as unknown as string[])?.find((c) =>
        c.startsWith('sid'),
      ) ?? '';

    const colCsrfRes = await request(server)
      .get('/api/csrf-token')
      .set('Cookie', [csrfCookie, sessionCookie].join('; '));
    const colCsrfToken = colCsrfRes.body.token as string;
    const colCsrfCookie =
      (colCsrfRes.headers['set-cookie'] as unknown as string[])?.find((c) =>
        c.startsWith('__csrf'),
      ) ?? csrfCookie;

    const colRes = await request(server)
      .post('/collections')
      .set('Cookie', [colCsrfCookie, sessionCookie].join('; '))
      .set('X-CSRF-Token', colCsrfToken)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'test-collection' });
    expect(colRes.status).toBe(201);
    const collectionId = colRes.body.collection.id as string;

    const docsRes = await request(server)
      .get(`/collections/${collectionId}/documents`)
      .set('Cookie', [colCsrfCookie, sessionCookie].join('; '))
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(docsRes.status).toBe(200);
    expect(Array.isArray(docsRes.body.documents)).toBe(true);
  });
});
