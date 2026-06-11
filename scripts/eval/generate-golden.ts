/** Generates synthetic golden Q&A pairs from demo handbook chunks for the judge eval system. */
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { closePool, query } from './lib/db.js';
import type { Collection, GoldenCase, GoldenFile } from './lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../apps/server/.env') });

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-6';
const MIN_TOKEN_COUNT = 80;
const QUALITY_THRESHOLD = 3;
const DEDUP_THRESHOLD = 0.85;
const BATCH_SIZE = 5;
const COLLECTIONS: Collection[] = ['valve', 'gitlab'];
const OUTPUT_PATH = resolve(__dirname, 'fixtures/golden.json');

interface RawPair {
  question: string;
  referenceAnswer: string;
}

interface Chunk {
  id: string;
  content: string;
  filename: string;
  chunk_index: number;
  token_count: number;
}

export function jaccardSimilarity(a: string, b: string): number {
  const tokenize = (s: string) => new Set(s.toLowerCase().split(/\s+/));
  const setA = tokenize(a);
  const setB = tokenize(b);
  const intersection = new Set([...setA].filter((t) => setB.has(t)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export function deduplicateQuestions(
  cases: GoldenCase[],
  threshold: number,
): GoldenCase[] {
  const kept: GoldenCase[] = [];
  for (const candidate of cases) {
    const isDuplicate = kept.some(
      (existing) =>
        jaccardSimilarity(candidate.question, existing.question) > threshold,
    );
    if (!isDuplicate) kept.push(candidate);
  }
  return kept;
}

async function generatePairsFromChunk(
  client: Anthropic,
  chunk: Chunk,
  model: string,
): Promise<RawPair[]> {
  const prompt = `You are generating evaluation test cases for a RAG system built on policy documents.

Given this chunk from a policy document, generate 2 questions that:
- Can be answered directly from this chunk alone
- Are specific (not "what does this document cover?")
- Vary in complexity: one factual lookup, one requiring inference

For each question, provide the ideal reference answer using ONLY information in this chunk.

Respond with JSON only, no markdown: [{ "question": "...", "referenceAnswer": "..." }, ...]

Chunk (from "${chunk.filename}", chunk ${chunk.chunk_index}):
${chunk.content}`;

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text : '';
  try {
    return JSON.parse(text) as RawPair[];
  } catch {
    return [];
  }
}

async function scoreQualityWithHaiku(
  client: Anthropic,
  pair: RawPair,
  chunkContent: string,
): Promise<number> {
  const prompt = `Rate this Q&A pair for evaluation quality on a scale of 1-5.

A score of 5 means: the question is specific and answerable from the chunk, the answer is accurate and grounded.
A score of 1 means: the question is vague or unanswerable, or the answer is wrong/hallucinated.

Respond with a single integer 1-5, nothing else.

Chunk: ${chunkContent.slice(0, 500)}
Question: ${pair.question}
Answer: ${pair.referenceAnswer}`;

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 10,
    messages: [{ role: 'user', content: prompt }],
  });

  const text =
    response.content[0]?.type === 'text'
      ? response.content[0].text.trim()
      : '0';
  const score = parseInt(text, 10);
  return isNaN(score) ? 0 : score;
}

async function fetchChunksForCollection(
  collectionId: string,
): Promise<Chunk[]> {
  const result = await query<Chunk>(
    `SELECT c.id, c.content, d.filename, c.chunk_index, c.token_count
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.collection_id = $1 AND c.token_count >= $2
     ORDER BY d.filename, c.chunk_index`,
    [collectionId, MIN_TOKEN_COUNT],
  );
  return result.rows;
}

async function fetchCollectionId(name: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    `SELECT id FROM collections WHERE name ILIKE $1 LIMIT 1`,
    [`%${name}%`],
  );
  return result.rows[0]?.id ?? null;
}

async function processBatch(
  client: Anthropic,
  chunks: Chunk[],
  collection: Collection,
  model: string,
): Promise<GoldenCase[]> {
  const cases: GoldenCase[] = [];

  for (const chunk of chunks) {
    const pairs = await generatePairsFromChunk(client, chunk, model);

    for (const pair of pairs) {
      const score = await scoreQualityWithHaiku(client, pair, chunk.content);
      if (score < QUALITY_THRESHOLD) continue;

      const id = createHash('sha1')
        .update(`${collection}:${chunk.id}:${pair.question}`)
        .digest('hex')
        .slice(0, 8);

      cases.push({
        id,
        collection,
        question: pair.question,
        referenceAnswer: pair.referenceAnswer,
        generatorModel: model,
      });
    }
  }

  return cases;
}

export async function generateGoldenSet(): Promise<void> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const collectionIds: Record<Collection, string> = { valve: '', gitlab: '' };

  for (const name of COLLECTIONS) {
    const id = await fetchCollectionId(name);
    if (!id)
      throw new Error(
        `Collection not found for "${name}". Run seed-demo-handbooks.ts first.`,
      );
    collectionIds[name] = id;
  }

  const allCases: GoldenCase[] = [];

  for (const collection of COLLECTIONS) {
    const chunks = await fetchChunksForCollection(collectionIds[collection]);
    console.log(`[${collection}] ${chunks.length} chunks to process`);

    const models = [HAIKU_MODEL, SONNET_MODEL];

    for (const model of models) {
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const cases = await processBatch(client, batch, collection, model);
        allCases.push(...cases);
        console.log(
          `  [${collection}/${model.split('-')[1]}] batch ${Math.floor(i / BATCH_SIZE) + 1}: +${cases.length} cases (total: ${allCases.length})`,
        );
      }
    }
  }

  const deduplicated = deduplicateQuestions(allCases, DEDUP_THRESHOLD);
  console.log(
    `\nDeduplicated: ${allCases.length} -> ${deduplicated.length} cases`,
  );

  const goldenFile: GoldenFile = { collectionIds, cases: deduplicated };
  writeFileSync(OUTPUT_PATH, JSON.stringify(goldenFile, null, 2));
  console.log(`\nWrote ${deduplicated.length} cases to ${OUTPUT_PATH}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateGoldenSet()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => closePool());
}
