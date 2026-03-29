import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

vi.mock('app/repositories/auth/auth.js', () => ({
  getSessionWithUser: vi.fn(),
}));

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

import * as authRepo from 'app/repositories/auth/auth.js';
import { loadSession, requireAuth } from './requireAuth.js';

const mockGetSessionWithUser = vi.mocked(authRepo.getSessionWithUser);

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(loadSession);

  app.get('/protected', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  app.get('/public', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

describe('requireAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadSession', () => {
    it('attaches user to request when session is valid', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        first_name: 'Test',
        last_name: 'User',
        created_at: new Date(),
        updated_at: null,
      };
      mockGetSessionWithUser.mockResolvedValue(mockUser);

      const app = createApp();
      const res = await request(app)
        .get('/protected')
        .set('Cookie', 'sid=valid-session-token');

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: 'user-1',
        email: 'test@test.com',
      });
    });

    it('does not attach user when no session cookie present', async () => {
      const app = createApp();
      const res = await request(app).get('/protected');

      expect(res.status).toBe(401);
      expect(mockGetSessionWithUser).not.toHaveBeenCalled();
    });

    it('does not attach user when session is expired/invalid', async () => {
      mockGetSessionWithUser.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app)
        .get('/protected')
        .set('Cookie', 'sid=expired-token');

      expect(res.status).toBe(401);
    });

    it('allows public routes without session', async () => {
      const app = createApp();
      const res = await request(app).get('/public');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe('requireAuth', () => {
    it('returns 401 with error message when not authenticated', async () => {
      const app = createApp();
      const res = await request(app).get('/protected');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { message: 'Authentication required' },
      });
    });

    it('passes through when authenticated', async () => {
      mockGetSessionWithUser.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        first_name: 'Test',
        last_name: 'User',
        created_at: new Date(),
        updated_at: null,
      });

      const app = createApp();
      const res = await request(app)
        .get('/protected')
        .set('Cookie', 'sid=valid-token');

      expect(res.status).toBe(200);
    });
  });
});
