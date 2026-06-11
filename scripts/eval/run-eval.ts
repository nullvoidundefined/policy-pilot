/** Runs the RAG pipeline offline against golden Q&A pairs, writing results to fixtures/. */
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { closePool, query } from './lib/db.js';
import { generateEmbedding } from './lib/embed.js';
import type {
  CitedChunkEval,
  EvalResult,
  GoldenCase,
  GoldenFile,
  RunConfig,
} from './lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../apps/server/.env') });

const SONNET_MODEL = 'claude-sonnet-4-6';
const DEFAULT_TOP_K = 6;
const BATCH_SIZE = 5;
const GOLDEN_PATH = resolve(__dirname, 'fixtures/golden.json');
const RESULTS_PATH = resolve(__dirname, 'fixtures/results-latest.json');

export const BASELINE_SYSTEM_PROMPT = `You are a helpful document Q&A assistant. Answer questions based ONLY on the provided context from the user's documents.

Rules:
- Only use information from the provided context to answer questions
- Cite your sources using [1], [2], etc. markers that correspond to the numbered context chunks
- If the context doesn't contain enough information to answer, say "I don't have enough information in the provided documents to answer this question."
- Be concise and direct in your answers
- When multiple chunks support a claim, cite all relevant ones`;

export function buildContextPrompt(
  chunks: CitedChunkEval[],
  question: string,
): string {
  const contextParts = chunks.map(
    (chunk, i) =>
      `[${i + 1}] (From "${chunk.filename}", chunk ${chunk.chunk_index}):\n${chunk.content}`,
  );
  return `Context from documents:\n\n${contextParts.join('\n\n---\n\n')}\n\nQuestion: ${question}`;
}

export function batchItems<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

async function retrieveChunks(
  collectionId: string,
  embedding: number[],
  topK: number,
): Promise<CitedChunkEval[]> {
  const vectorLiteral = `[${embedding.join(',')}]`;
  const result = await query<CitedChunkEval>(
    `SELECT c.id, c.document_id, c.chunk_index, c.content, d.filename
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.collection_id = $1
     ORDER BY c.embedding <=> $2::vector
     LIMIT $3`,
    [collectionId, vectorLiteral, topK],
  );
  return result.rows;
}

async function generateAnswer(
  client: Anthropic,
  systemPrompt: string,
  chunks: CitedChunkEval[],
  question: string,
): Promise<string> {
  const response = await client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: buildContextPrompt(chunks, question) }],
  });
  return response.content[0]?.type === 'text' ? response.content[0].text : '';
}

async function processCase(
  client: Anthropic,
  goldenCase: GoldenCase,
  runConfig: RunConfig,
): Promise<EvalResult> {
  const collectionId = runConfig.collectionIds[goldenCase.collection];
  const embedding = await generateEmbedding(goldenCase.question);
  const retrievedChunks = await retrieveChunks(
    collectionId,
    embedding,
    runConfig.topK,
  );
  const answer = await generateAnswer(
    client,
    runConfig.promptVariant,
    retrievedChunks,
    goldenCase.question,
  );

  return {
    ...goldenCase,
    retrievedChunks,
    answer,
    topK: runConfig.topK,
    promptVariant: runConfig.promptVariant,
  };
}

export async function runEval(
  configOverrides?: Partial<RunConfig>,
): Promise<EvalResult[]> {
  if (!existsSync(GOLDEN_PATH)) {
    throw new Error(
      `Golden file not found at ${GOLDEN_PATH}. Run generate-golden.ts first.`,
    );
  }

  const goldenFile = JSON.parse(
    readFileSync(GOLDEN_PATH, 'utf-8'),
  ) as GoldenFile;
  const runConfig: RunConfig = {
    topK: DEFAULT_TOP_K,
    promptVariant: BASELINE_SYSTEM_PROMPT,
    variantLabel: 'baseline',
    collectionIds: goldenFile.collectionIds,
    ...configOverrides,
  };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const results: EvalResult[] = [];
  const batches = batchItems(goldenFile.cases, BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]!;
    console.log(
      `Batch ${batchIndex + 1}/${batches.length} (${batch.length} cases)`,
    );

    const batchResults = await Promise.all(
      batch.map((goldenCase) => processCase(client, goldenCase, runConfig)),
    );
    results.push(...batchResults);
    writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
  }

  console.log(`\nWrote ${results.length} results to ${RESULTS_PATH}`);
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runEval()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => closePool());
}
