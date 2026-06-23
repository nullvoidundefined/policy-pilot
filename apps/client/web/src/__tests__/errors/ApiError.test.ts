import { ApiError } from '@/errors/ApiError';
import { describe, expect, it } from 'vitest';

describe('ApiError', () => {
  it('carries status and message and is an Error', () => {
    const err = new ApiError(404, 'not found');

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(404);
    expect(err.message).toBe('not found');
  });
});
