/** Returns a presigned GET URL for an R2 object, valid for expiresIn seconds. */
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { BUCKET } from './constants.js';
import { s3 } from './s3Client.js';

const DEFAULT_EXPIRY_SECONDS = 3600;

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = DEFAULT_EXPIRY_SECONDS,
): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn,
  });
}
