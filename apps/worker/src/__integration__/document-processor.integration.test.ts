/** Integration test for the document processing pipeline. Real DB, mocked R2/embeddings/Anthropic. */
import pool from 'app/db/pool.js';
import { processDocument } from 'app/processors/document-processor.js';
import * as embeddingService from 'app/services/embedding.service.js';
import * as r2Service from 'app/services/r2.service.js';
import type { Job } from 'bullmq';
import { readFileSync } from 'fs';
import path from 'path';
import type { DocumentProcessJob } from 'policy-pilot-common';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const POLICY_FIXTURE = path.resolve(__dirname, 'fixtures/policy.txt');
const EMBEDDING_DIM = 1536;
const TEST_EMAIL = 'worker-processor@integration-test.invalid';
const TEST_R2_KEY = 'test/worker-integration/policy.txt';

vi.mock('app/services/r2.service.js', () => ({
  downloadFile: vi.fn(),
}));

vi.mock('app/services/embedding.service.js', () => ({
  generateEmbeddingsBatch: vi.fn(),
}));

const mockAnthropicCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

async function seedUser(): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, 'x', 'Worker', 'Test')
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [TEST_EMAIL],
  );
  return result.rows[0]!.id;
}

async function seedCollection(userId: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO collections (user_id, name)
     VALUES ($1, 'Worker Test Collection')
     RETURNING id`,
    [userId],
  );
  return result.rows[0]!.id;
}

async function seedDocument(
  userId: string,
  collectionId: string,
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO documents (user_id, filename, r2_key, mime_type, size_bytes, collection_id, status)
     VALUES ($1, 'policy.txt', $2, 'text/plain', 1000, $3, 'uploaded')
     RETURNING id`,
    [userId, TEST_R2_KEY, collectionId],
  );
  return result.rows[0]!.id;
}

function makeJob(data: DocumentProcessJob): Job<DocumentProcessJob> {
  return {
    data,
    id: 'integration-test-job',
    log: vi.fn(),
    updateProgress: vi.fn(),
  } as unknown as Job<DocumentProcessJob>;
}

describe('processDocument', () => {
  let userId: string;
  let collectionId: string;
  let documentId: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"score": 0.9, "reason": "HR policy document about remote work"}',
        },
      ],
    });

    vi.mocked(r2Service.downloadFile).mockResolvedValue(
      readFileSync(POLICY_FIXTURE),
    );
    vi.mocked(embeddingService.generateEmbeddingsBatch).mockImplementation(
      async (texts: string[]) => texts.map(() => Array(EMBEDDING_DIM).fill(0)),
    );

    userId = await seedUser();
    collectionId = await seedCollection(userId);
    documentId = await seedDocument(userId, collectionId);
  });

  afterEach(async () => {
    await pool.query('DELETE FROM chunks WHERE document_id = $1', [documentId]);
    await pool.query('DELETE FROM documents WHERE id = $1', [documentId]);
    await pool.query('DELETE FROM collections WHERE id = $1', [collectionId]);
  });

  it('sets status to ready and stores chunks in pgvector', async () => {
    await processDocument(
      makeJob({
        documentId,
        userId,
        r2Key: TEST_R2_KEY,
        mimeType: 'text/plain',
        collectionId,
      }),
    );

    const docRow = await pool.query<{ status: string; total_chunks: number }>(
      'SELECT status, total_chunks FROM documents WHERE id = $1',
      [documentId],
    );
    expect(docRow.rows[0]!.status).toBe('ready');
    expect(docRow.rows[0]!.total_chunks).toBeGreaterThanOrEqual(1);

    const chunkRow = await pool.query<{ count: string }>(
      'SELECT COUNT(*) FROM chunks WHERE document_id = $1',
      [documentId],
    );
    const chunkCount = parseInt(chunkRow.rows[0]!.count, 10);
    expect(chunkCount).toBeGreaterThanOrEqual(1);
    expect(chunkCount).toBe(docRow.rows[0]!.total_chunks);
  });

  it('calls r2Service.downloadFile with the r2Key', async () => {
    const downloadSpy = vi.mocked(r2Service.downloadFile);

    await processDocument(
      makeJob({
        documentId,
        userId,
        r2Key: TEST_R2_KEY,
        mimeType: 'text/plain',
        collectionId,
      }),
    );

    expect(downloadSpy).toHaveBeenCalledWith(TEST_R2_KEY);
  });

  it('calls generateEmbeddingsBatch with the chunk texts', async () => {
    const embedSpy = vi.mocked(embeddingService.generateEmbeddingsBatch);

    await processDocument(
      makeJob({
        documentId,
        userId,
        r2Key: TEST_R2_KEY,
        mimeType: 'text/plain',
        collectionId,
      }),
    );

    expect(embedSpy).toHaveBeenCalledTimes(1);
    const [chunkTexts] = embedSpy.mock.calls[0] as [string[]];
    expect(chunkTexts.length).toBeGreaterThanOrEqual(1);
    expect(typeof chunkTexts[0]).toBe('string');
  });

  it('sets status to failed when the document contains no extractable text', async () => {
    vi.mocked(r2Service.downloadFile).mockResolvedValue(Buffer.from('   '));

    await processDocument(
      makeJob({
        documentId,
        userId,
        r2Key: TEST_R2_KEY,
        mimeType: 'text/plain',
        collectionId,
      }),
    );

    const docRow = await pool.query<{ status: string; error: string | null }>(
      'SELECT status, error FROM documents WHERE id = $1',
      [documentId],
    );
    expect(docRow.rows[0]!.status).toBe('failed');
    expect(docRow.rows[0]!.error).toMatch(/No text content/);
  });

  it('sets status to rejected when the Anthropic relevance score is below 0.5', async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"score": 0.2, "reason": "This is not a policy document"}',
        },
      ],
    });

    await processDocument(
      makeJob({
        documentId,
        userId,
        r2Key: TEST_R2_KEY,
        mimeType: 'text/plain',
        collectionId,
      }),
    );

    const docRow = await pool.query<{ status: string }>(
      'SELECT status FROM documents WHERE id = $1',
      [documentId],
    );
    expect(docRow.rows[0]!.status).toBe('rejected');
  });
});
