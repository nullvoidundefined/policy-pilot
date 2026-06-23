import { createCollection } from '@/api/createCollection';
import { deleteCollection } from '@/api/deleteCollection';
import { getCollections } from '@/api/getCollections';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPost, mockDel } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockDel: vi.fn(),
}));

vi.mock('@/api/request', () => ({
  get: mockGet,
  post: mockPost,
  del: mockDel,
}));

describe('collection api wrappers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getCollections GETs /collections', () => {
    mockGet.mockReturnValue(Promise.resolve({ collections: [] }));
    void getCollections();
    expect(mockGet).toHaveBeenCalledWith('/collections');
  });

  it('createCollection POSTs name and description', () => {
    mockPost.mockReturnValue(Promise.resolve({ collection: {} }));
    void createCollection('Reports', 'Q2');
    expect(mockPost).toHaveBeenCalledWith('/collections', {
      name: 'Reports',
      description: 'Q2',
    });
  });

  it('deleteCollection DELETEs the collection by id', () => {
    mockDel.mockReturnValue(Promise.resolve());
    void deleteCollection('col-1');
    expect(mockDel).toHaveBeenCalledWith('/collections/col-1');
  });
});
