import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('generateEmbedding', () => {
  const originalKey = process.env.OPEN_AI_API_KEY;

  beforeEach(() => {
    delete process.env.OPEN_AI_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.OPEN_AI_API_KEY = originalKey;
    }
  });

  it('throws when OPEN_AI_API_KEY is not set', async () => {
    const { generateEmbedding } = await import('../lib/embed.js');
    await expect(generateEmbedding('hello')).rejects.toThrow(
      'OPEN_AI_API_KEY is not set',
    );
  });
});
