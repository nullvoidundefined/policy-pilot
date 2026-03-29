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

import {
  createDocument,
  getDocumentById,
  listDocuments,
  updateDocumentStatus,
  deleteDocument,
} from './documents.js';

describe('documents repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDocument', () => {
    it('inserts a document and returns the row', async () => {
      const mockDoc = {
        id: 'doc-1',
        user_id: 'user-1',
        filename: 'test.pdf',
        r2_key: 'documents/user-1/abc/test.pdf',
        mime_type: 'application/pdf',
        size_bytes: 1024,
        status: 'uploaded',
      };
      mockQuery.mockResolvedValue({ rows: [mockDoc] });

      const result = await createDocument(
        'user-1',
        'test.pdf',
        'documents/user-1/abc/test.pdf',
        'application/pdf',
        1024,
      );

      expect(result).toEqual(mockDoc);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO documents'),
        ['user-1', 'test.pdf', 'documents/user-1/abc/test.pdf', 'application/pdf', 1024],
        undefined,
      );
    });

    it('throws when insert returns no row', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await expect(
        createDocument('user-1', 'test.pdf', 'key', 'application/pdf', 100),
      ).rejects.toThrow('Insert returned no row');
    });
  });

  describe('getDocumentById', () => {
    it('returns document when found', async () => {
      const mockDoc = { id: 'doc-1', user_id: 'user-1', filename: 'test.pdf' };
      mockQuery.mockResolvedValue({ rows: [mockDoc] });

      const result = await getDocumentById('doc-1', 'user-1');
      expect(result).toEqual(mockDoc);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND user_id = $2'),
        ['doc-1', 'user-1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getDocumentById('nonexistent', 'user-1');
      expect(result).toBeNull();
    });
  });

  describe('listDocuments', () => {
    it('returns all documents for a user', async () => {
      const docs = [
        { id: 'doc-1', filename: 'a.pdf' },
        { id: 'doc-2', filename: 'b.pdf' },
      ];
      mockQuery.mockResolvedValue({ rows: docs });

      const result = await listDocuments('user-1');
      expect(result).toEqual(docs);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        ['user-1'],
      );
    });

    it('returns empty array when user has no documents', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await listDocuments('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('updateDocumentStatus', () => {
    it('updates status only', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await updateDocumentStatus('doc-1', 'ready');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('status = $2'),
        ['doc-1', 'ready'],
      );
    });

    it('updates status with total_chunks', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await updateDocumentStatus('doc-1', 'ready', { total_chunks: 10 });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('total_chunks'),
        ['doc-1', 'ready', 10],
      );
    });

    it('updates status with error message', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await updateDocumentStatus('doc-1', 'failed', {
        error: 'Processing failed',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('error'),
        ['doc-1', 'failed', 'Processing failed'],
      );
    });
  });

  describe('deleteDocument', () => {
    it('returns true when document deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await deleteDocument('doc-1', 'user-1');
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM documents WHERE id = $1 AND user_id = $2'),
        ['doc-1', 'user-1'],
      );
    });

    it('returns false when document not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const result = await deleteDocument('nonexistent', 'user-1');
      expect(result).toBe(false);
    });
  });
});
