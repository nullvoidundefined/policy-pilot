import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from './auth.js';

describe('auth schemas', () => {
  describe('registerSchema', () => {
    it('accepts valid registration data', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = registerSchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
      });
      expect(result.success).toBe(false);
    });

    it('rejects password shorter than 8 characters', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'short',
        first_name: 'John',
        last_name: 'Doe',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]!.message).toContain('8 characters');
      }
    });

    it('rejects empty first_name', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        first_name: '',
        last_name: 'Doe',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty last_name', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing fields', () => {
      const result = registerSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'bad',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });
});
