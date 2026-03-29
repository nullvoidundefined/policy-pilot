import { describe, it, expect } from 'vitest';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from './session.js';

describe('session constants', () => {
  it('uses "sid" as cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('sid');
  });

  it('sets TTL to 7 days', () => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(SESSION_TTL_MS).toBe(sevenDaysMs);
  });
});
