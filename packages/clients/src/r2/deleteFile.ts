/** Deletes an object from Cloudflare R2 by key. */
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

import { BUCKET } from './constants.js';
import { s3 } from './s3Client.js';

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
