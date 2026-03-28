import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

const BUCKET = process.env.R2_BUCKET_NAME ?? 'doc-qa-rag';

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

export async function downloadFile(key: string): Promise<Buffer> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  );
  const stream = response.Body;
  if (!stream) throw new Error('Empty response body from R2');

  // Convert readable stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn,
  });
}
