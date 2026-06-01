import * as authRepo from 'app/repositories/auth/auth.js';
import { ApiError } from 'app/utils/ApiError.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { login, logout, me, register } from './auth.js';

vi.mock('app/repositories/auth/auth.js', () => ({
  createUserAndSession: vi.fn(),
  findUserByEmail: vi.fn(),
  verifyPassword: vi.fn(),
  loginUser: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock('app/config/env.js', () => ({
  isProduction: vi.fn().mockReturnValue(false),
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

const mockAuthRepo = vi.mocked(authRepo);

function mockReq(overrides: Record<string, unknown> = {}): any {
  return {
    body: {},
    cookies: {},
    ip: '127.0.0.1',
    ...overrides,
  };
}

function mockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  return res;
}

describe('auth handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('returns 201 with user on success', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        first_name: 'Test',
        last_name: 'User',
        created_at: '2024-01-01',
      };
      mockAuthRepo.createUserAndSession.mockResolvedValue({
        user: mockUser as any,
        sessionId: 'session-123',
      });

      const req = mockReq({
        body: {
          email: 'test@test.com',
          password: 'password123',
          first_name: 'Test',
          last_name: 'User',
        },
      });
      const res = mockRes();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.cookie).toHaveBeenCalledWith(
        'sid',
        'session-123',
        expect.any(Object),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ id: 'user-1' }),
        }),
      );
    });

    it('throws ApiError for invalid input', async () => {
      const req = mockReq({ body: { email: 'bad' } });
      const res = mockRes();

      await expect(register(req, res)).rejects.toThrow(ApiError);
      await expect(register(req, res)).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('throws ApiError with CONFLICT for duplicate email', async () => {
      mockAuthRepo.createUserAndSession.mockRejectedValue({ code: '23505' });

      const req = mockReq({
        body: {
          email: 'dup@test.com',
          password: 'password123',
          first_name: 'Test',
          last_name: 'User',
        },
      });
      const res = mockRes();

      await expect(register(req, res)).rejects.toThrow(ApiError);
      await expect(register(req, res)).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Email already registered',
      });
    });
  });

  describe('login', () => {
    it('returns user and sets session cookie on success', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        password_hash: 'hash',
        first_name: 'Test',
        last_name: 'User',
        created_at: '2024-01-01',
      };
      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser as any);
      mockAuthRepo.verifyPassword.mockResolvedValue(true);
      mockAuthRepo.loginUser.mockResolvedValue('session-456');

      const req = mockReq({
        body: { email: 'test@test.com', password: 'password123' },
      });
      const res = mockRes();

      await login(req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'sid',
        'session-456',
        expect.any(Object),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ id: 'user-1' }),
        }),
      );
    });

    it('throws ApiError.unauthorized for nonexistent email', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(null);

      const req = mockReq({
        body: { email: 'nobody@test.com', password: 'password123' },
      });
      const res = mockRes();

      await expect(login(req, res)).rejects.toThrow(ApiError);
      await expect(login(req, res)).rejects.toMatchObject({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    });

    it('throws ApiError.unauthorized for wrong password', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        password_hash: 'hash',
      } as any);
      mockAuthRepo.verifyPassword.mockResolvedValue(false);

      const req = mockReq({
        body: { email: 'test@test.com', password: 'wrong' },
      });
      const res = mockRes();

      await expect(login(req, res)).rejects.toThrow(ApiError);
      await expect(login(req, res)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('throws ApiError.badRequest for invalid input', async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();

      await expect(login(req, res)).rejects.toThrow(ApiError);
      await expect(login(req, res)).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('logout', () => {
    it('clears session cookie and returns 204', async () => {
      mockAuthRepo.deleteSession.mockResolvedValue(true);

      const req = mockReq({ cookies: { sid: 'token-123' } });
      const res = mockRes();

      await logout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith('sid', { path: '/' });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('handles logout without session cookie', async () => {
      const req = mockReq({ cookies: {} });
      const res = mockRes();

      await logout(req, res);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(mockAuthRepo.deleteSession).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('returns the current user', async () => {
      const req = mockReq({ user: { id: 'user-1', email: 'test@test.com' } });
      const res = mockRes();

      await me(req, res);

      expect(res.json).toHaveBeenCalledWith({
        user: { id: 'user-1', email: 'test@test.com' },
      });
    });
  });
});
