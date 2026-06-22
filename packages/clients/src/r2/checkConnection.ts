/** Verifies connectivity to the Cloudflare R2 bucket (health check). */
import { HeadBucketCommand } from '@aws-sdk/client-s3';

import { BUCKET } from './constants.js';
import { s3 } from './s3Client.js';

export async function checkConnection(): Promise<void> {
  await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
}
