/** Uploads a file buffer to Cloudflare R2 under the given key. */
import { PutObjectCommand } from '@aws-sdk/client-s3';

import { BUCKET } from './constants.js';
import { s3 } from './s3Client.js';

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
