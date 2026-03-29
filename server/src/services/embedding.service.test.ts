import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('app/utils/logs/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { generateEmbedding, generateEmbeddings } from './embedding.service.js';

describe('embedding service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPEN_AI_API_KEY = 'test-key';
  });

  describe('generateEmbeddings', () => {
    it('calls OpenAI embeddings API with correct params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2] }],
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      await generateEmbeddings(['hello']);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
    });

    it('returns embedding arrays', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2, 0.3] },
            { embedding: [0.4, 0.5, 0.6] },
          ],
          usage: { prompt_tokens: 10, total_tokens: 10 },
        }),
      });

      const result = await generateEmbeddings(['text1', 'text2']);
      expect(result).toEqual([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]);
    });

    it('throws when API key is missing', async () => {
      delete process.env.OPEN_AI_API_KEY;

      await expect(generateEmbeddings(['test'])).rejects.toThrow(
        'OPEN_AI_API_KEY is not set',
      );
    });

    it('throws on API error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      await expect(generateEmbeddings(['test'])).rejects.toThrow(
        'Embedding API error (429)',
      );
    });
  });

  describe('generateEmbedding', () => {
    it('returns a single embedding vector', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
          usage: { prompt_tokens: 3, total_tokens: 3 },
        }),
      });

      const result = await generateEmbedding('hello');
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });
  });
});
