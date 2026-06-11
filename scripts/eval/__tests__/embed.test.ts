import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OPEN_AI_API_KEY_ENV = 'OPEN_AI_API_KEY';

describe('generateEmbedding', () => {
  const originalKey = process.env[OPEN_AI_API_KEY_ENV];

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalKey !== undefined) {
      process.env[OPEN_AI_API_KEY_ENV] = originalKey;
    } else {
      delete process.env[OPEN_AI_API_KEY_ENV];
    }
  });

  it('throws when OPEN_AI_API_KEY is not set', async () => {
    delete process.env[OPEN_AI_API_KEY_ENV];
    const { generateEmbedding } = await import('../lib/embed.js');
    await expect(generateEmbedding('hello')).rejects.toThrow(
      `${OPEN_AI_API_KEY_ENV} is not set`,
    );
  });

  it('throws on non-ok HTTP response', async () => {
    process.env[OPEN_AI_API_KEY_ENV] = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      }),
    );
    const { generateEmbedding } = await import('../lib/embed.js');
    await expect(generateEmbedding('hello')).rejects.toThrow(
      'Embedding API error (401)',
    );
  });

  it('throws when API returns no embedding', async () => {
    process.env[OPEN_AI_API_KEY_ENV] = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      }),
    );
    const { generateEmbedding } = await import('../lib/embed.js');
    await expect(generateEmbedding('hello')).rejects.toThrow(
      'No embedding returned',
    );
  });
});
