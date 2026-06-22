/** BullMQ job orchestrator for the document RAG pipeline: download, extract, relevance-check, chunk, embed, store, sequencing the worker's atomic services and repositories (R-227). */
import { chunkText } from '@repo/chunker';
import { generateEmbeddings } from '@repo/clients/openai';
import { downloadFile } from '@repo/clients/r2';
import { logger } from '@repo/logger';
import type { DocumentProcessJob } from '@repo/types';
import { insertChunk } from 'app/repositories/chunks.js';
import { updateDocumentStatus } from 'app/repositories/documents.js';
import { checkDocumentRelevance } from 'app/services/checkDocumentRelevance.js';
import { extractText } from 'app/services/extractText.js';
import type { Job } from 'bullmq';

const NO_TEXT_ERROR = 'No text content found in document';

export async function processDocument(
  job: Job<DocumentProcessJob>,
): Promise<void> {
  const { documentId, userId, r2Key, mimeType } = job.data;
  const log = logger.child({ documentId, userId, jobId: job.id });

  try {
    // 1. Download from R2
    log.info('Downloading document from R2');
    const fileBuffer = await downloadFile(r2Key);

    // 2. Extract text
    log.info('Extracting text');
    await updateDocumentStatus(documentId, 'chunking');
    const text = await extractText(fileBuffer, mimeType);

    if (text.trim().length === 0) {
      await updateDocumentStatus(documentId, 'failed', {
        error: NO_TEXT_ERROR,
      });
      return;
    }

    // 2b. Relevance check
    log.info('Running relevance check');
    const relevance = await checkDocumentRelevance(text, log);
    if (!relevance.isRelevant) {
      log.info(
        { relevanceScore: relevance.score, relevanceReason: relevance.reason },
        'Document rejected as not policy-related',
      );
      await updateDocumentStatus(documentId, 'rejected', {
        error: `This doesn't appear to be a policy document: ${relevance.reason}`,
      });
      return;
    }
    log.info(
      { relevanceScore: relevance.score },
      'Document passed relevance check',
    );

    // 3. Chunk text
    log.info({ textLength: text.length }, 'Chunking text');
    const chunks = chunkText(text, { maxTokens: 500, overlapTokens: 50 });
    log.info({ chunkCount: chunks.length }, 'Text chunked');

    // 4. Generate embeddings
    log.info('Generating embeddings');
    await updateDocumentStatus(documentId, 'embedding');
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(chunkTexts);

    // 5. Store chunks + embeddings in pgvector
    log.info('Storing chunks in database');
    for (let i = 0; i < chunks.length; i++) {
      await insertChunk(documentId, userId, chunks[i]!, embeddings[i]!);
    }

    // 6. Update document status
    await updateDocumentStatus(documentId, 'ready', {
      total_chunks: chunks.length,
    });
    log.info({ chunkCount: chunks.length }, 'Document processing complete');
  } catch (err) {
    log.error({ err }, 'Document processing failed');
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown processing error';
    await updateDocumentStatus(documentId, 'failed', { error: errorMessage });
    throw err;
  }
}
