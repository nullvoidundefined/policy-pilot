import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();
const mockGetSignedUrl = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: (...args: unknown[]) => mockSend(...args),
    })),
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ _type: 'Put', input })),
    GetObjectCommand: vi.fn().mockImplementation((input) => ({ _type: 'Get', input })),
    DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ _type: 'Delete', input })),
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

import { uploadFile, deleteFile, getSignedDownloadUrl } from './r2.service.js';

describe('r2 service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('sends PutObjectCommand to S3', async () => {
      mockSend.mockResolvedValue({});

      await uploadFile('test/key.pdf', Buffer.from('content'), 'application/pdf');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteFile', () => {
    it('sends DeleteObjectCommand to S3', async () => {
      mockSend.mockResolvedValue({});

      await deleteFile('test/key.pdf');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSignedDownloadUrl', () => {
    it('returns a signed URL', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url.com/test');

      const url = await getSignedDownloadUrl('test/key.pdf');
      expect(url).toBe('https://signed-url.com/test');
    });
  });
});
