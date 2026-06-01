import { documentProcessQueue } from 'app/config/queue.js';
import * as docsRepo from 'app/repositories/documents/documents.js';
import * as r2Service from 'app/services/r2.service.js';
import { ApiError } from 'app/utils/ApiError.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteDocument,
  getDocument,
  listDocuments,
  uploadDocument,
} from './documents.js';

vi.mock('app/repositories/documents/documents.js', () => ({
  createDocument: vi.fn(),
  getDocumentById: vi.fn(),
  listDocuments: vi.fn(),
  deleteDocument: vi.fn(),
}));

vi.mock('app/services/r2.service.js', () => ({
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock('app/config/queue.js', () => ({
  documentProcessQueue: {
    add: vi.fn(),
  },
  redisConnection: {
    quit: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock('app/utils/logs/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

const mockDocsRepo = vi.mocked(docsRepo);
const mockR2 = vi.mocked(r2Service);
const mockQueue = vi.mocked(documentProcessQueue);

function mockReq(overrides: Record<string, unknown> = {}): any {
  return {
    user: { id: 'user-1' },
    params: {},
    body: {},
    ...overrides,
  };
}

function mockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

describe('documents handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadDocument', () => {
    it('uploads file and enqueues processing job', async () => {
      const mockDoc = {
        id: 'doc-1',
        user_id: 'user-1',
        filename: 'test.pdf',
        r2_key: 'documents/user-1/uuid/test.pdf',
        status: 'uploaded',
      };
      mockDocsRepo.createDocument.mockResolvedValue(mockDoc as any);
      mockR2.uploadFile.mockResolvedValue(undefined);
      mockQueue.add.mockResolvedValue({} as any);

      const req = mockReq({
        body: { collection_id: 'col-1' },
        file: {
          originalname: 'test.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('pdf content'),
          size: 1024,
        },
      });
      const res = mockRes();

      await uploadDocument(req, res);

      expect(mockR2.uploadFile).toHaveBeenCalled();
      expect(mockDocsRepo.createDocument).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process',
        expect.objectContaining({
          documentId: 'doc-1',
          userId: 'user-1',
          collectionId: 'col-1',
        }),
        expect.objectContaining({ attempts: 3 }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('throws ApiError when no file uploaded', async () => {
      const req = mockReq({ file: undefined });
      const res = mockRes();

      await expect(uploadDocument(req, res)).rejects.toThrow(ApiError);
      await expect(uploadDocument(req, res)).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'No file uploaded',
      });
    });

    it('throws ApiError when collection_id is missing', async () => {
      const req = mockReq({
        file: {
          originalname: 'test.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('pdf content'),
          size: 1024,
        },
      });
      const res = mockRes();

      await expect(uploadDocument(req, res)).rejects.toThrow(ApiError);
      await expect(uploadDocument(req, res)).rejects.toMatchObject({
        statusCode: 400,
        message: 'collection_id is required',
      });
    });

    it('rejects unsupported file types', async () => {
      const req = mockReq({
        body: { collection_id: 'col-1' },
        file: {
          originalname: 'image.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('content'),
          size: 100,
        },
      });
      const res = mockRes();

      await expect(uploadDocument(req, res)).rejects.toThrow(ApiError);
      await expect(uploadDocument(req, res)).rejects.toMatchObject({
        statusCode: 400,
        message:
          'Unsupported file type. Upload PDF, DOCX, TXT, MD, or HTML files.',
      });
    });

    it('rejects files over 10MB', async () => {
      const req = mockReq({
        body: { collection_id: 'col-1' },
        file: {
          originalname: 'big.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.alloc(1),
          size: 11 * 1024 * 1024,
        },
      });
      const res = mockRes();

      await expect(uploadDocument(req, res)).rejects.toThrow(ApiError);
      await expect(uploadDocument(req, res)).rejects.toMatchObject({
        statusCode: 400,
        message: 'File too large. Maximum size is 10MB.',
      });
    });

    it('accepts text/plain files', async () => {
      const mockDoc = { id: 'doc-2', user_id: 'user-1', filename: 'notes.txt' };
      mockDocsRepo.createDocument.mockResolvedValue(mockDoc as any);
      mockQueue.add.mockResolvedValue({} as any);

      const req = mockReq({
        body: { collection_id: 'col-1' },
        file: {
          originalname: 'notes.txt',
          mimetype: 'text/plain',
          buffer: Buffer.from('text'),
          size: 100,
        },
      });
      const res = mockRes();

      await uploadDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('accepts text/markdown files', async () => {
      const mockDoc = { id: 'doc-3', user_id: 'user-1', filename: 'readme.md' };
      mockDocsRepo.createDocument.mockResolvedValue(mockDoc as any);
      mockQueue.add.mockResolvedValue({} as any);

      const req = mockReq({
        body: { collection_id: 'col-1' },
        file: {
          originalname: 'readme.md',
          mimetype: 'text/markdown',
          buffer: Buffer.from('# Hello'),
          size: 100,
        },
      });
      const res = mockRes();

      await uploadDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('listDocuments', () => {
    it('returns user documents', async () => {
      const docs = [{ id: 'doc-1' }, { id: 'doc-2' }];
      mockDocsRepo.listDocuments.mockResolvedValue(docs as any);

      const req = mockReq();
      const res = mockRes();

      await listDocuments(req, res);

      expect(res.json).toHaveBeenCalledWith({ documents: docs });
      expect(mockDocsRepo.listDocuments).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getDocument', () => {
    it('returns document when found', async () => {
      const doc = { id: 'doc-1', user_id: 'user-1' };
      mockDocsRepo.getDocumentById.mockResolvedValue(doc as any);

      const req = mockReq({ params: { id: 'doc-1' } });
      const res = mockRes();

      await getDocument(req, res);

      expect(res.json).toHaveBeenCalledWith({ document: doc });
    });

    it('throws ApiError.notFound when document not found', async () => {
      mockDocsRepo.getDocumentById.mockResolvedValue(null);

      const req = mockReq({ params: { id: 'doc-999' } });
      const res = mockRes();

      await expect(getDocument(req, res)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('throws ApiError.badRequest when id is missing', async () => {
      const req = mockReq({ params: {} });
      const res = mockRes();

      await expect(getDocument(req, res)).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('deleteDocument', () => {
    it('deletes document and R2 file', async () => {
      const doc = { id: 'doc-1', user_id: 'user-1', r2_key: 'some/key.pdf' };
      mockDocsRepo.getDocumentById.mockResolvedValue(doc as any);
      mockDocsRepo.deleteDocument.mockResolvedValue(true);
      mockR2.deleteFile.mockResolvedValue(undefined);

      const req = mockReq({ params: { id: 'doc-1' } });
      const res = mockRes();

      await deleteDocument(req, res);

      expect(mockR2.deleteFile).toHaveBeenCalledWith('some/key.pdf');
      expect(mockDocsRepo.deleteDocument).toHaveBeenCalledWith(
        'doc-1',
        'user-1',
      );
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('throws ApiError.notFound when document not found', async () => {
      mockDocsRepo.getDocumentById.mockResolvedValue(null);

      const req = mockReq({ params: { id: 'doc-999' } });
      const res = mockRes();

      await expect(deleteDocument(req, res)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('still deletes document if R2 deletion fails', async () => {
      const doc = { id: 'doc-1', user_id: 'user-1', r2_key: 'some/key.pdf' };
      mockDocsRepo.getDocumentById.mockResolvedValue(doc as any);
      mockR2.deleteFile.mockRejectedValue(new Error('R2 error'));
      mockDocsRepo.deleteDocument.mockResolvedValue(true);

      const req = mockReq({ params: { id: 'doc-1' } });
      const res = mockRes();

      await deleteDocument(req, res);

      expect(mockDocsRepo.deleteDocument).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });
});
