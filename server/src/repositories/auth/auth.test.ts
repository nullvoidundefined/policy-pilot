import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
const mockWithTransaction = vi.fn();

vi.mock('app/db/pool/pool.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (fn: Function) => mockWithTransaction(fn),
  default: { query: vi.fn(), end: vi.fn(), on: vi.fn() },
}));

vi.mock('app/utils/logs/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn(),
  },
}));

import bcrypt from 'bcrypt';
import {
  createUser,
  findUserByEmail,
  verifyPassword,
  getSessionWithUser,
  deleteSession,
} from './auth.js';

const mockBcrypt = vi.mocked(bcrypt);

describe('auth repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createUser', () => {
    it('hashes password and inserts user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        first_name: 'Test',
        last_name: 'User',
      };
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await createUser('Test@Test.com', 'password123', 'Test', 'User');

      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['test@test.com', 'hashed_password', 'Test', 'User'],
        undefined,
      );
      expect(result).toEqual(mockUser);
    });

    it('lowercases and trims email', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'user-1' }] });

      await createUser('  USER@EXAMPLE.COM  ', 'password123', 'Test', 'User');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['user@example.com']),
        undefined,
      );
    });
  });

  describe('findUserByEmail', () => {
    it('returns user when found', async () => {
      const mockUser = { id: 'user-1', email: 'test@test.com', password_hash: 'hash' };
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await findUserByEmail('test@test.com');
      expect(result).toEqual(mockUser);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await findUserByEmail('nobody@test.com');
      expect(result).toBeNull();
    });
  });

  describe('verifyPassword', () => {
    it('returns true for matching password', async () => {
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await verifyPassword('password123', 'hashed');
      expect(result).toBe(true);
    });

    it('returns false for wrong password', async () => {
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await verifyPassword('wrong', 'hashed');
      expect(result).toBe(false);
    });
  });

  describe('getSessionWithUser', () => {
    it('returns user for valid non-expired session', async () => {
      const mockUser = { id: 'user-1', email: 'test@test.com' };
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await getSessionWithUser('valid-token');
      expect(result).toEqual(mockUser);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('expires_at > NOW()'),
        expect.any(Array),
      );
    });

    it('returns null for expired or invalid session', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getSessionWithUser('expired-token');
      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('returns true when session deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await deleteSession('token');
      expect(result).toBe(true);
    });

    it('returns false when session not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const result = await deleteSession('nonexistent');
      expect(result).toBe(false);
    });
  });
});
