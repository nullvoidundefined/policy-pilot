import { getDemoCollections } from 'app/handlers/collections/collections.js';
import * as collectionsRepo from 'app/repositories/collections/index.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/collections/index.js', () => ({
  getDemoCollections: vi.fn(),
  createCollection: vi.fn(),
  listCollections: vi.fn(),
  getCollectionById: vi.fn(),
  getCollectionDocumentCount: vi.fn(),
  deleteCollection: vi.fn(),
}));

vi.mock('app/repositories/documents/index.js', () => ({
  listDocuments: vi.fn(),
}));

const mockCollectionsRepo = vi.mocked(collectionsRepo);

function mockReq(overrides: Record<string, unknown> = {}): any {
  return {
    params: {},
    ...overrides,
  };
}

function mockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('collections handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDemoCollections', () => {
    it('returns demo collections when any exist', async () => {
      const collections = [{ id: 'demo-1' }, { id: 'demo-2' }];
      mockCollectionsRepo.getDemoCollections.mockResolvedValue(
        collections as any,
      );

      const req = mockReq();
      const res = mockRes();

      await getDemoCollections(req, res);

      expect(res.json).toHaveBeenCalledWith({ collections });
      expect(res.status).not.toHaveBeenCalledWith(404);
    });

    it('responds 404 with a plain error when none exist', async () => {
      mockCollectionsRepo.getDemoCollections.mockResolvedValue([]);

      const req = mockReq();
      const res = mockRes();

      await getDemoCollections(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No demo collections available',
      });
    });
  });
});
