/** Shared ioredis connection singleton for the BullMQ worker; isolated so the worker factory and shutdown handler import the same instance (R-235 shared-state module). */
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const connection = new IORedis.default(REDIS_URL, {
  maxRetriesPerRequest: null,
});
