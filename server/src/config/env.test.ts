import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isProduction } from './env.js';

describe('env config', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('returns true when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    expect(isProduction()).toBe(true);
  });

  it('returns false when NODE_ENV is development', () => {
    process.env.NODE_ENV = 'development';
    expect(isProduction()).toBe(false);
  });

  it('returns false when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test';
    expect(isProduction()).toBe(false);
  });

  it('returns false when NODE_ENV is undefined', () => {
    delete process.env.NODE_ENV;
    expect(isProduction()).toBe(false);
  });
});
