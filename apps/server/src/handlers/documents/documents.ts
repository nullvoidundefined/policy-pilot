import { documentProcessQueue } from 'app/config/queue.js';
import * as docsRepo from 'app/repositories/documents/documents.js';
import * as r2Service from 'app/services/r2.service.js';
import { ApiError } from 'app/utils/ApiError.js';
import { logger } from 'app/utils/logs/logger.js';
import type { Request, Response } from 'express';
import type { DocumentProcessJob } from 'policy-pilot-common';

export async function uploadDocument(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user!;
  const file = req.file;
  const collectionId = req.body?.collection_id as string | undefined;

  if (!file) {
    throw ApiError.badRequest('No file uploaded');
  }

  if (!collectionId) {
    throw ApiError.badRequest('collection_id is required');
  }

  const allowedMimes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'text/html',
  ];
  if (!allowedMimes.includes(file.mimetype)) {
    throw ApiError.badRequest(
      'Unsupported file type. Upload PDF, DOCX, TXT, MD, or HTML files.',
    );
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw ApiError.badRequest('File too large. Maximum size is 10MB.');
  }

  const r2Key = `documents/${user.id}/${crypto.randomUUID()}/${file.originalname}`;

  await r2Service.uploadFile(r2Key, file.buffer, file.mimetype);

  const document = await docsRepo.createDocument(
    user.id,
    file.originalname,
    r2Key,
    file.mimetype,
    file.size,
    collectionId,
  );

  const jobData: DocumentProcessJob = {
    documentId: document.id,
    userId: user.id,
    r2Key,
    mimeType: file.mimetype,
    collectionId,
  };

  await documentProcessQueue.add('process', jobData, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });

  logger.info(
    {
      event: 'document_uploaded',
      documentId: document.id,
      userId: user.id,
      filename: file.originalname,
    },
    'Document uploaded and queued for processing',
  );

  res.status(201).json({ document });
}

export async function listDocuments(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user!;
  const documents = await docsRepo.listDocuments(user.id);
  res.json({ documents });
}

export async function getDocument(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const id = req.params.id as string | undefined;
  if (!id) {
    throw ApiError.badRequest('Document ID required');
  }

  const document = await docsRepo.getDocumentById(id, user.id);
  if (!document) {
    throw ApiError.notFound('Document not found');
  }
  res.json({ document });
}

export async function deleteDocument(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user!;
  const id = req.params.id as string | undefined;
  if (!id) {
    throw ApiError.badRequest('Document ID required');
  }

  const document = await docsRepo.getDocumentById(id, user.id);
  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  try {
    await r2Service.deleteFile(document.r2_key);
  } catch (err) {
    logger.warn(
      { err, r2Key: document.r2_key },
      'Failed to delete file from R2',
    );
  }

  await docsRepo.deleteDocument(id, user.id);
  res.status(204).send();
}
