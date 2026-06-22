import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateEmbedding, generateEmbeddings } from '../../openai/index.js';

vi.mock('@repo/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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

  describe('generateEmbeddings batching', () => {
    it('splits texts into batches of 100 and concatenates results in order', async () => {
      const totalTexts = 150;
      const texts = Array.from({ length: totalTexts }, (_, i) => `text-${i}`);

      let callCount = 0;

      mockFetch.mockImplementation(
        async (_url: string, options: RequestInit) => {
          const body = JSON.parse(options.body as string) as {
            input: string[];
          };
          const batchLength = body.input.length;
          const batchOffset = callCount * 100;
          callCount += 1;
          const embeddings = Array.from({ length: batchLength }, (_, j) => ({
            embedding: [batchOffset + j],
          }));
          return {
            ok: true,
            json: async () => ({
              data: embeddings,
              usage: { prompt_tokens: batchLength, total_tokens: batchLength },
            }),
          };
        },
      );

      const result = await generateEmbeddings(texts);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(150);
      // batch 1: indices 0..99, each embedding is [index]
      expect(result[0]).toEqual([0]);
      expect(result[99]).toEqual([99]);
      // batch 2: indices 100..149, each embedding is [index]
      expect(result[100]).toEqual([100]);
      expect(result[149]).toEqual([149]);
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
