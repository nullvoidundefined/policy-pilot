/** Downloads an object from Cloudflare R2 and returns its contents as a Buffer. */
import { GetObjectCommand } from '@aws-sdk/client-s3';

import { BUCKET } from './constants.js';
import { s3 } from './s3Client.js';

export async function downloadFile(key: string): Promise<Buffer> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  );
  const stream = response.Body;
  if (!stream) throw new Error('Empty response body from R2');

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
