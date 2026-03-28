import { documentProcessQueue } from 'app/config/queue.js';
import * as docsRepo from 'app/repositories/documents/documents.js';
import * as r2Service from 'app/services/r2.service.js';
import { logger } from 'app/utils/logs/logger.js';
import type { DocumentProcessJob } from 'doc-qa-rag-common';
import type { Request, Response } from 'express';

export async function uploadDocument(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user!;
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: { message: 'No file uploaded' } });
    return;
  }

  const allowedMimes = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
  ];
  if (!allowedMimes.includes(file.mimetype)) {
    res
      .status(400)
      .json({
        error: {
          message: 'Unsupported file type. Upload PDF, TXT, or MD files.',
        },
      });
    return;
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    res
      .status(400)
      .json({ error: { message: 'File too large. Maximum size is 10MB.' } });
    return;
  }

  const r2Key = `documents/${user.id}/${crypto.randomUUID()}/${file.originalname}`;

  await r2Service.uploadFile(r2Key, file.buffer, file.mimetype);

  const document = await docsRepo.createDocument(
    user.id,
    file.originalname,
    r2Key,
    file.mimetype,
    file.size,
  );

  const jobData: DocumentProcessJob = {
    documentId: document.id,
    userId: user.id,
    r2Key,
    mimeType: file.mimetype,
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
    res.status(400).json({ error: { message: 'Document ID required' } });
    return;
  }

  const document = await docsRepo.getDocumentById(id, user.id);
  if (!document) {
    res.status(404).json({ error: { message: 'Document not found' } });
    return;
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
    res.status(400).json({ error: { message: 'Document ID required' } });
    return;
  }

  const document = await docsRepo.getDocumentById(id, user.id);
  if (!document) {
    res.status(404).json({ error: { message: 'Document not found' } });
    return;
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
