import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();

vi.mock('app/db/pool/pool.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
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

import { searchChunks } from './retrieval.service.js';

describe('retrieval service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchChunks', () => {
    const mockEmbedding = [0.1, 0.2, 0.3];

    it('returns cited chunks with correct shape', async () => {
      const rows = [
        {
          id: 'chunk-1',
          document_id: 'doc-1',
          chunk_index: 0,
          content: 'Some text',
          filename: 'test.pdf',
          similarity: 0.95,
        },
      ];
      mockQuery.mockResolvedValue({ rows });

      const result = await searchChunks(mockEmbedding, 'user-1');
      expect(result).toEqual([
        {
          id: 'chunk-1',
          document_id: 'doc-1',
          chunk_index: 0,
          content: 'Some text',
          filename: 'test.pdf',
        },
      ]);
    });

    it('scopes search to user_id', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searchChunks(mockEmbedding, 'user-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE c.user_id = $2'),
        expect.arrayContaining(['user-1']),
      );
    });

    it('uses similarity ordering via pgvector', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searchChunks(mockEmbedding, 'user-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY c.embedding <=> $1::vector'),
        expect.any(Array),
      );
    });

    it('respects topK limit', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searchChunks(mockEmbedding, 'user-1', 3);
      const sql = mockQuery.mock.calls[0]![0] as string;
      expect(sql).toContain('LIMIT');
      const values = mockQuery.mock.calls[0]![1] as unknown[];
      expect(values).toContain(3);
    });

    it('filters by document_ids when provided', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searchChunks(mockEmbedding, 'user-1', 6, ['doc-1', 'doc-2']);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND c.document_id = ANY($3)'),
        expect.arrayContaining([['doc-1', 'doc-2']]),
      );
    });

    it('does not add document_id filter when not provided', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searchChunks(mockEmbedding, 'user-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.not.stringContaining('document_id = ANY'),
        expect.any(Array),
      );
    });

    it('returns empty array when no chunks match', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await searchChunks(mockEmbedding, 'user-1');
      expect(result).toEqual([]);
    });

    it('formats embedding as pgvector string', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searchChunks([0.1, 0.2, 0.3], 'user-1');
      const values = mockQuery.mock.calls[0]![1] as unknown[];
      expect(values[0]).toBe('[0.1,0.2,0.3]');
    });
  });
});
