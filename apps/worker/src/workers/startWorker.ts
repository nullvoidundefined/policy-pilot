/** Boots the worker process: starts the BullMQ worker and health server, then registers graceful-shutdown handlers for SIGTERM/SIGINT. */
import { logger } from '@repo/logger';
import { createDocumentProcessWorker } from 'app/workers/documentProcessWorker.js';
import { connection } from 'app/workers/redisConnection.js';
import { startHealthServer } from 'app/workers/startHealthServer.js';

export function startWorker(): void {
  const worker = createDocumentProcessWorker();
  const healthServer = startHealthServer();

  logger.info('Document processing worker started');

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutting down worker gracefully');
    await worker.close();
    await connection.quit();
    healthServer.close();
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
