import { processDocument } from 'app/processors/document-processor.js';
import { logger } from 'app/utils/logger.js';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import http from 'node:http';
import type { DocumentProcessJob } from 'policy-pilot-common/types';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

const connection = new IORedis.default(redisUrl, {
  maxRetriesPerRequest: null,
});

const worker = new Worker<DocumentProcessJob>(
  'document-process',
  async (job) => {
    logger.info(
      { jobId: job.id, documentId: job.data.documentId },
      'Processing document',
    );
    await processDocument(job);
  },
  {
    connection,
    concurrency: 2,
  },
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

const healthServer = http.createServer((_req, res) => {
  res.writeHead(200);
  res.end('ok');
});
healthServer.listen(
  Number(process.env.PORT || process.env.WORKER_PORT) || 3002,
);

logger.info('Document processing worker started');

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down worker gracefully');
  await worker.close();
  await connection.quit();
  healthServer.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
