/** Constructs the BullMQ Worker for the document-process queue and attaches its lifecycle event handlers. */
import { logger } from '@repo/logger';
import type { DocumentProcessJob } from '@repo/types';
import { processDocument } from 'app/processors/processDocument.js';
import { connection } from 'app/workers/redisConnection.js';
import { Worker } from 'bullmq';

const QUEUE_NAME = 'document-process';
const WORKER_CONCURRENCY = 2;

export function createDocumentProcessWorker(): Worker<DocumentProcessJob> {
  const worker = new Worker<DocumentProcessJob>(
    QUEUE_NAME,
    async (job) => {
      logger.info(
        { jobId: job.id, documentId: job.data.documentId },
        'Processing document',
      );
      await processDocument(job);
    },
    { connection, concurrency: WORKER_CONCURRENCY },
  );

  worker.on('completed', (job) => {
    logger.info(
      { jobId: job.id, documentId: job.data.documentId },
      'Job completed',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, documentId: job?.data.documentId, err },
      'Job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker error');
  });

  return worker;
}
