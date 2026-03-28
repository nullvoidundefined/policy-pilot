import { Worker } from "bullmq";
import IORedis from "ioredis";

import { processDocument } from "app/processors/document-processor.js";
import { logger } from "app/utils/logger.js";
import type { DocumentProcessJob } from "doc-qa-rag-common/types";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const connection = new IORedis.default(redisUrl, {
  maxRetriesPerRequest: null,
});

const worker = new Worker<DocumentProcessJob>(
  "document-process",
  async (job) => {
    logger.info({ jobId: job.id, documentId: job.data.documentId }, "Processing document");
    await processDocument(job);
  },
  {
    connection,
    concurrency: 2,
  },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id, documentId: job.data.documentId }, "Job completed");
});

worker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, documentId: job?.data.documentId, err },
    "Job failed",
  );
});

worker.on("error", (err) => {
  logger.error({ err }, "Worker error");
});

logger.info("Document processing worker started");

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down worker gracefully");
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
