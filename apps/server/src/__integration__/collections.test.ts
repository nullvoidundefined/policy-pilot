import { app } from 'app/app.js';
import pool from 'app/db/pool/pool.js';
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
    const userId = registerRes.body.user.id as string;

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

    await pool.query(
      `INSERT INTO documents (user_id, filename, r2_key, mime_type, size_bytes, collection_id)
       VALUES ($1, 'test.txt', 'test/key.txt', 'text/plain', 100, $2)`,
      [userId, collectionId],
    );

    const docsRes = await request(server)
      .get(`/collections/${collectionId}/documents`)
      .set('Cookie', [colCsrfCookie, sessionCookie].join('; '))
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(docsRes.status).toBe(200);
    expect(docsRes.body.documents).toHaveLength(1);
    expect(docsRes.body.documents[0].filename).toBe('test.txt');
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .get('/collections/00000000-0000-0000-0000-000000000000/documents')
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(401);
    expect(res.status).toBe(401);
  });
});
