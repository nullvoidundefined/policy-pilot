/**
 * Initializes the shared Redis connection and the BullMQ document-processing queue,
 * owning the queue-layer boundary so every producer imports one pre-configured instance.
 */
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redisConnection = new IORedis.default(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redisConnection.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});

export const documentProcessQueue = new Queue('document-process', {
  connection: redisConnection,
});
