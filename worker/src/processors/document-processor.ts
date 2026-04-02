import { query } from 'app/db/pool.js';
import * as embeddingService from 'app/services/embedding.service.js';
import * as r2Service from 'app/services/r2.service.js';
import * as textExtractor from 'app/services/text-extractor.service.js';
import { logger } from 'app/utils/logger.js';
import type { Job } from 'bullmq';
import { chunkText } from 'policy-pilot-common/chunker';
import type { DocumentProcessJob } from 'policy-pilot-common/types';

async function updateStatus(
  documentId: string,
  status: string,
  extra?: { total_chunks?: number; error?: string },
): Promise<void> {
  const sets = ['status = $2'];
  const values: unknown[] = [documentId, status];
  let idx = 3;
  if (extra?.total_chunks !== undefined) {
    sets.push(`total_chunks = $${idx}`);
    values.push(extra.total_chunks);
    idx++;
  }
  if (extra?.error !== undefined) {
    sets.push(`error = $${idx}`);
    values.push(extra.error);
    idx++;
  }
  await query(`UPDATE documents SET ${sets.join(', ')} WHERE id = $1`, values);
}

export async function processDocument(
  job: Job<DocumentProcessJob>,
): Promise<void> {
  const { documentId, userId, r2Key, mimeType } = job.data;
  const log = logger.child({ documentId, userId, jobId: job.id });

  try {
    // 1. Download from R2
    log.info('Downloading document from R2');
    const fileBuffer = await r2Service.downloadFile(r2Key);

    // 2. Extract text
    log.info('Extracting text');
    await updateStatus(documentId, 'chunking');
    const text = await textExtractor.extractText(fileBuffer, mimeType);

    if (text.trim().length === 0) {
      await updateStatus(documentId, 'failed', {
        error: 'No text content found in document',
      });
      return;
    }

    // 3. Chunk text
    log.info({ textLength: text.length }, 'Chunking text');
    const chunks = chunkText(text, { maxTokens: 500, overlapTokens: 50 });
    log.info({ chunkCount: chunks.length }, 'Text chunked');

    // 4. Generate embeddings
    log.info('Generating embeddings');
    await updateStatus(documentId, 'embedding');
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings =
      await embeddingService.generateEmbeddingsBatch(chunkTexts);

    // 5. Store chunks + embeddings in pgvector
    log.info('Storing chunks in database');
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const embedding = embeddings[i]!;
      const embeddingStr = `[${embedding.join(',')}]`;

      await query(
        `INSERT INTO chunks (document_id, user_id, chunk_index, content, token_count, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        [
          documentId,
          userId,
          chunk.index,
          chunk.content,
          chunk.tokenCount,
          embeddingStr,
        ],
      );
    }

    // 6. Update document status
    await updateStatus(documentId, 'ready', { total_chunks: chunks.length });
    log.info({ chunkCount: chunks.length }, 'Document processing complete');
  } catch (err) {
    log.error({ err }, 'Document processing failed');
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown processing error';
    await updateStatus(documentId, 'failed', { error: errorMessage });
    throw err;
  }
}
