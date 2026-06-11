# Judge Eval System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modular offline eval harness that generates synthetic golden Q&A pairs, scores PolicyPilot RAG answers across 5 dimensions with Claude Opus as judge, and iteratively tunes prompts and topK until the run-level mean score exceeds 4.8/5.

**Architecture:** Seven files in `scripts/eval/` -- three shared lib modules (types, db, embed) and five single-purpose scripts (generate-golden, run-eval, judge, improve, report). Each script exports its core function for programmatic use by the improvement loop and also runs standalone via `npx tsx`. No Express server required; scripts connect directly to Neon via the `DATABASE_URL` in `apps/server/.env`.

**Tech Stack:** TypeScript (tsx), `@anthropic-ai/sdk`, `pg`, `dotenv`, `vitest` (all available in root workspace). Models: Haiku + Sonnet for golden generation, Opus for judging, Sonnet for answer generation.

---

## File Map

| Action | Path                                            | Responsibility                                |
| ------ | ----------------------------------------------- | --------------------------------------------- |
| Create | `scripts/eval/lib/types.ts`                     | All shared interfaces                         |
| Create | `scripts/eval/lib/db.ts`                        | pg pool connecting to Neon                    |
| Create | `scripts/eval/lib/embed.ts`                     | OpenAI embedding wrapper                      |
| Create | `scripts/eval/vitest.config.ts`                 | Test runner config                            |
| Create | `scripts/eval/fixtures/.gitkeep`                | Ensure fixtures dir exists                    |
| Modify | `.gitignore`                                    | Ignore generated fixture outputs              |
| Create | `scripts/eval/__tests__/embed.test.ts`          | Error-path tests for embed                    |
| Create | `scripts/eval/generate-golden.ts`               | Haiku+Sonnet -> golden.json                   |
| Create | `scripts/eval/__tests__/generateGolden.test.ts` | dedup + jaccard tests                         |
| Create | `scripts/eval/run-eval.ts`                      | Pipeline runner -> results                    |
| Create | `scripts/eval/__tests__/runEval.test.ts`        | batchItems + buildContextPrompt tests         |
| Create | `scripts/eval/judge.ts`                         | Opus scorer -> scores                         |
| Create | `scripts/eval/__tests__/judge.test.ts`          | parseJudgeResponse tests                      |
| Create | `scripts/eval/report.ts`                        | Console reporter                              |
| Create | `scripts/eval/__tests__/report.test.ts`         | formatBar + computeMeans + formatReport tests |
| Create | `scripts/eval/improve.ts`                       | Improvement loop -> recommendations           |
| Create | `scripts/eval/__tests__/improve.test.ts`        | selectLever tests                             |

---

## Task 1: Shared infrastructure

**Files:**

- Create: `scripts/eval/lib/types.ts`
- Create: `scripts/eval/lib/db.ts`
- Create: `scripts/eval/lib/embed.ts`
- Create: `scripts/eval/vitest.config.ts`
- Create: `scripts/eval/fixtures/.gitkeep`
- Modify: `.gitignore`
- Create: `scripts/eval/__tests__/embed.test.ts`

- [ ] **Step 1: Write failing test for embed error path**

Create `scripts/eval/__tests__/embed.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('generateEmbedding', () => {
  const originalKey = process.env.OPEN_AI_API_KEY;

  beforeEach(() => {
    delete process.env.OPEN_AI_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.OPEN_AI_API_KEY = originalKey;
    }
  });

  it('throws when OPEN_AI_API_KEY is not set', async () => {
    const { generateEmbedding } = await import('../lib/embed.js');
    await expect(generateEmbedding('hello')).rejects.toThrow(
      'OPEN_AI_API_KEY is not set',
    );
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run --config scripts/eval/vitest.config.ts
```

Expected: error because `vitest.config.ts` and `lib/embed.ts` do not exist yet.

- [ ] **Step 3: Create `scripts/eval/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `scripts/eval/lib/types.ts`**

```ts
/** Shared interfaces for the PolicyPilot judge eval system. */

export type Collection = 'valve' | 'gitlab';

export interface CitedChunkEval {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  filename: string;
}

export interface GoldenCase {
  id: string;
  collection: Collection;
  question: string;
  referenceAnswer: string;
  generatorModel: string;
}

export interface GoldenFile {
  collectionIds: Record<Collection, string>;
  cases: GoldenCase[];
}

export interface EvalResult extends GoldenCase {
  retrievedChunks: CitedChunkEval[];
  answer: string;
  topK: number;
  promptVariant: string;
}

export interface DimensionScores {
  faithfulness: number;
  answerRelevance: number;
  citationAccuracy: number;
  completeness: number;
  contextRecall: number;
}

export interface ScoredResult extends EvalResult {
  scores: DimensionScores;
  meanScore: number;
  judgeReasoning: string;
}

export interface RunConfig {
  topK: number;
  promptVariant: string;
  variantLabel: string;
  collectionIds: Record<Collection, string>;
}

export interface Recommendations {
  finalMeanScore: number;
  bestTopK: number;
  bestPrompt: string;
  iterationsRun: number;
  dimensionScores: DimensionScores;
  changeLog: Array<{ round: number; change: string; scoreDelta: number }>;
}
```

- [ ] **Step 5: Create `scripts/eval/lib/db.ts`**

```ts
/** Direct pg connection to Neon for eval scripts. No Express required. */
import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../apps/server/.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: { rejectUnauthorized: false },
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  values?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(sql, values);
}

export async function closePool(): Promise<void> {
  await pool.end();
}
```

- [ ] **Step 6: Create `scripts/eval/lib/embed.ts`**

```ts
/** OpenAI text-embedding-3-small wrapper, matching the server embedding service. */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) throw new Error('OPEN_AI_API_KEY is not set');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [text],
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding API error (${response.status}): ${body}`);
  }

  const result = (await response.json()) as EmbeddingResponse;
  const embedding = result.data[0]?.embedding;
  if (!embedding) throw new Error('No embedding returned');
  return embedding;
}
```

- [ ] **Step 7: Create `scripts/eval/fixtures/.gitkeep`**

Create an empty file at `scripts/eval/fixtures/.gitkeep`.

- [ ] **Step 8: Update `.gitignore`**

Append to the existing `.gitignore`:

```
# eval fixtures (generated outputs -- golden.json is committed, outputs are not)
scripts/eval/fixtures/results-latest.json
scripts/eval/fixtures/scores-latest.json
scripts/eval/fixtures/recommendations.json
```

- [ ] **Step 9: Run tests from the eval config directory**

```bash
npx vitest run --config scripts/eval/vitest.config.ts
```

Expected output:

```
PASS  __tests__/embed.test.ts
  generateEmbedding
    + throws when OPEN_AI_API_KEY is not set
```

- [ ] **Step 10: Commit**

```bash
git add scripts/eval/lib/types.ts scripts/eval/lib/db.ts scripts/eval/lib/embed.ts \
        scripts/eval/vitest.config.ts scripts/eval/fixtures/.gitkeep \
        scripts/eval/__tests__/embed.test.ts .gitignore
git commit -m "feat(eval): scaffold shared lib -- types, db, embed, vitest config"
```

---

## Task 2: Golden set generator

**Files:**

- Create: `scripts/eval/__tests__/generateGolden.test.ts`
- Create: `scripts/eval/generate-golden.ts`

- [ ] **Step 1: Write failing tests for jaccardSimilarity and deduplicateQuestions**

Create `scripts/eval/__tests__/generateGolden.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { deduplicateQuestions, jaccardSimilarity } from '../generate-golden.js';
import type { GoldenCase } from '../lib/types.js';

function makeCase(id: string, question: string): GoldenCase {
  return {
    id,
    collection: 'valve',
    question,
    referenceAnswer: 'ref',
    generatorModel: 'claude-haiku-4-5-20251001',
  };
}

describe('jaccardSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(jaccardSimilarity('what is the policy', 'what is the policy')).toBe(
      1,
    );
  });

  it('returns 0 for completely different strings', () => {
    expect(jaccardSimilarity('apple orange', 'banana grape')).toBe(0);
  });

  it('returns partial similarity for overlapping words', () => {
    const sim = jaccardSimilarity(
      'what is the vacation policy at Valve',
      'what is the sick leave policy at Valve',
    );
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});

describe('deduplicateQuestions', () => {
  it('keeps a single case unchanged', () => {
    const cases = [makeCase('a', 'What is the vacation policy?')];
    expect(deduplicateQuestions(cases, 0.85)).toHaveLength(1);
  });

  it('removes a near-duplicate above threshold', () => {
    const cases = [
      makeCase('a', 'What is the vacation policy at Valve?'),
      makeCase('b', 'What is the vacation policy at Valve?'),
    ];
    expect(deduplicateQuestions(cases, 0.85)).toHaveLength(1);
  });

  it('keeps clearly distinct questions', () => {
    const cases = [
      makeCase('a', 'What is the vacation policy?'),
      makeCase('b', 'How does peer review work?'),
      makeCase('c', 'What benefits does Valve offer employees?'),
    ];
    expect(deduplicateQuestions(cases, 0.85)).toHaveLength(3);
  });

  it('keeps first of a duplicate pair', () => {
    const cases = [
      makeCase('first', 'What is the vacation policy at Valve?'),
      makeCase('second', 'What is the vacation policy at Valve?'),
    ];
    expect(deduplicateQuestions(cases, 0.85)[0]?.id).toBe('first');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run --config scripts/eval/vitest.config.ts
```

Expected: FAIL -- `generate-golden.js` not found.

- [ ] **Step 3: Create `scripts/eval/generate-golden.ts`**

```ts
/** Generates the golden Q&A dataset from Valve and GitLab demo handbook chunks. */
import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { closePool, query } from './lib/db.js';
import type { Collection, GoldenCase, GoldenFile } from './lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, 'fixtures');

const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';
const MIN_TOKEN_COUNT = 80;
const MIN_QUALITY_SCORE = 3;
const DEDUP_THRESHOLD = 0.85;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  filename: string;
  token_count: number;
  collection_name: string;
}

interface GeneratedPair {
  question: string;
  referenceAnswer: string;
}

function buildGenerationPrompt(chunk: ChunkRow): string {
  return `You are generating evaluation test cases for a RAG system built on policy documents.

Given this chunk from a policy document, generate 2 questions that:
- Can be answered directly from this chunk alone
- Are specific (not "what does this document cover?")
- Vary in complexity: one factual lookup, one requiring inference

For each question, provide the ideal reference answer using ONLY information in this chunk.

Respond with JSON only: [{ "question": "...", "referenceAnswer": "..." }, ...]

Chunk (from "${chunk.filename}", chunk ${chunk.chunk_index}):
${chunk.content}`;
}

async function generatePairs(
  model: string,
  chunk: ChunkRow,
): Promise<GeneratedPair[]> {
  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 600,
      messages: [{ role: 'user', content: buildGenerationPrompt(chunk) }],
    });
    const text =
      message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as GeneratedPair[];
  } catch {
    return [];
  }
}

async function scoreQuality(pair: GeneratedPair): Promise<number> {
  try {
    const message = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: `Rate this Q&A pair quality 1-5. Reply with a single digit only.\nQ: ${pair.question}\nA: ${pair.referenceAnswer}`,
        },
      ],
    });
    const text =
      message.content[0]?.type === 'text'
        ? message.content[0].text.trim()
        : '0';
    return parseInt(text.charAt(0), 10) || 0;
  } catch {
    return 0;
  }
}

export function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function deduplicateQuestions(
  cases: GoldenCase[],
  threshold: number,
): GoldenCase[] {
  const kept: GoldenCase[] = [];
  for (const c of cases) {
    const isDuplicate = kept.some(
      (k) => jaccardSimilarity(k.question, c.question) >= threshold,
    );
    if (!isDuplicate) kept.push(c);
  }
  return kept;
}

async function fetchDemoChunks(): Promise<{
  chunks: ChunkRow[];
  collectionIds: Record<Collection, string>;
}> {
  const collectionsResult = await query<{ id: string; name: string }>(
    `SELECT id, name FROM collections WHERE is_demo = true ORDER BY name`,
  );

  const collectionIds: Partial<Record<Collection, string>> = {};
  for (const row of collectionsResult.rows) {
    if (row.name.toLowerCase().includes('valve')) collectionIds.valve = row.id;
    if (row.name.toLowerCase().includes('gitlab'))
      collectionIds.gitlab = row.id;
  }

  if (!collectionIds.valve || !collectionIds.gitlab) {
    throw new Error(
      'Demo collections not found. Run: npx tsx scripts/seed-demo-handbooks.ts',
    );
  }

  const chunksResult = await query<ChunkRow>(
    `SELECT c.id, c.document_id, c.chunk_index, c.content, d.filename,
            c.token_count, col.name AS collection_name
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     JOIN collections col ON col.id = d.collection_id
     WHERE col.is_demo = true AND c.token_count >= $1
     ORDER BY col.name, c.chunk_index`,
    [MIN_TOKEN_COUNT],
  );

  return {
    chunks: chunksResult.rows,
    collectionIds: collectionIds as Record<Collection, string>,
  };
}

export async function generateGoldenSet(): Promise<void> {
  const { chunks, collectionIds } = await fetchDemoChunks();
  console.log(`Found ${chunks.length} qualifying chunks`);

  const allCases: GoldenCase[] = [];

  for (const chunk of chunks) {
    const collection: Collection = chunk.collection_name
      .toLowerCase()
      .includes('valve')
      ? 'valve'
      : 'gitlab';

    for (const model of [HAIKU, SONNET]) {
      const pairs = await generatePairs(model, chunk);
      for (const pair of pairs) {
        const quality = await scoreQuality(pair);
        if (quality >= MIN_QUALITY_SCORE) {
          allCases.push({
            id: `${collection}-c${chunk.chunk_index}-${model.slice(-5)}-${allCases.length}`,
            collection,
            question: pair.question,
            referenceAnswer: pair.referenceAnswer,
            generatorModel: model,
          });
        }
      }
    }
    process.stdout.write('.');
  }

  console.log(`\nGenerated ${allCases.length} raw cases`);
  const deduplicated = deduplicateQuestions(allCases, DEDUP_THRESHOLD);
  console.log(`After dedup: ${deduplicated.length} cases`);

  mkdirSync(FIXTURES_DIR, { recursive: true });
  const output: GoldenFile = { collectionIds, cases: deduplicated };
  writeFileSync(
    resolve(FIXTURES_DIR, 'golden.json'),
    JSON.stringify(output, null, 2),
  );
  console.log(`Written to fixtures/golden.json`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateGoldenSet()
    .catch(console.error)
    .finally(() => closePool());
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run --config scripts/eval/vitest.config.ts
```

Expected:

```
PASS  __tests__/generateGolden.test.ts
  jaccardSimilarity
    + returns 1 for identical strings
    + returns 0 for completely different strings
    + returns partial similarity for overlapping words
  deduplicateQuestions
    + keeps a single case unchanged
    + removes a near-duplicate above threshold
    + keeps clearly distinct questions
    + keeps first of a duplicate pair
```

- [ ] **Step 5: Commit**

```bash
git add scripts/eval/generate-golden.ts scripts/eval/__tests__/generateGolden.test.ts
git commit -m "feat(eval): add golden set generator with Haiku+Sonnet dedup"
```

---

## Task 3: Eval runner

**Files:**

- Create: `scripts/eval/__tests__/runEval.test.ts`
- Create: `scripts/eval/run-eval.ts`

- [ ] **Step 1: Write failing tests for batchItems and buildContextPrompt**

Create `scripts/eval/__tests__/runEval.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { CitedChunkEval } from '../lib/types.js';
import { batchItems, buildContextPrompt } from '../run-eval.js';

describe('batchItems', () => {
  it('splits an array into batches of the given size', () => {
    expect(batchItems([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('puts the remainder in the final batch', () => {
    const batches = batchItems([1, 2, 3, 4, 5], 2);
    expect(batches).toHaveLength(3);
    expect(batches[2]).toEqual([5]);
  });

  it('returns empty array for empty input', () => {
    expect(batchItems([], 5)).toEqual([]);
  });

  it('returns one batch when size >= length', () => {
    expect(batchItems([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });
});

describe('buildContextPrompt', () => {
  const chunks: CitedChunkEval[] = [
    {
      id: 'c1',
      document_id: 'd1',
      chunk_index: 0,
      content: 'Valve is a flat company.',
      filename: 'handbook.txt',
    },
    {
      id: 'c2',
      document_id: 'd1',
      chunk_index: 1,
      content: 'Desks have wheels.',
      filename: 'handbook.txt',
    },
  ];

  it('numbers chunks starting at 1', () => {
    const prompt = buildContextPrompt(chunks, 'What kind of company is Valve?');
    expect(prompt).toContain('[1]');
    expect(prompt).toContain('[2]');
  });

  it('includes the question at the end', () => {
    const prompt = buildContextPrompt(chunks, 'What kind of company is Valve?');
    expect(prompt).toMatch(/Question: What kind of company is Valve\?/);
  });

  it('includes chunk content', () => {
    const prompt = buildContextPrompt(chunks, 'q');
    expect(prompt).toContain('Valve is a flat company.');
    expect(prompt).toContain('Desks have wheels.');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run --config scripts/eval/vitest.config.ts
```

Expected: FAIL -- `run-eval.js` not found.

- [ ] **Step 3: Create `scripts/eval/run-eval.ts`**

```ts
/** Runs golden Q&A cases through the RAG pipeline and records raw results. */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
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
const FIXTURES_DIR = resolve(__dirname, 'fixtures');
const ANSWER_MODEL = 'claude-sonnet-4-6';
const BATCH_SIZE = 5;

const BASELINE_PROMPT = `You are a helpful document Q&A assistant. Answer questions based ONLY on the provided context from the user's documents.

Rules:
- Only use information from the provided context to answer questions
- Cite your sources using [1], [2], etc. markers that correspond to the numbered context chunks
- If the context doesn't contain enough information to answer, say "I don't have enough information in the provided documents to answer this question."
- Be concise and direct in your answers
- When multiple chunks support a claim, cite all relevant ones`;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export function buildContextPrompt(
  chunks: CitedChunkEval[],
  question: string,
): string {
  const parts = chunks.map(
    (c, i) =>
      `[${i + 1}] (From "${c.filename}", chunk ${c.chunk_index}):\n${c.content}`,
  );
  return `Context from documents:\n\n${parts.join('\n\n---\n\n')}\n\nQuestion: ${question}`;
}

export function batchItems<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

async function retrieveChunks(
  embedding: number[],
  collectionId: string,
  topK: number,
): Promise<CitedChunkEval[]> {
  const embeddingStr = `[${embedding.join(',')}]`;
  const result = await query<CitedChunkEval & { similarity: number }>(
    `SELECT c.id, c.document_id, c.chunk_index, c.content, d.filename,
            1 - (c.embedding <=> $1::vector) AS similarity
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE c.embedding IS NOT NULL
       AND d.collection_id = $2
     ORDER BY c.embedding <=> $1::vector
     LIMIT $3`,
    [embeddingStr, collectionId, topK],
  );
  return result.rows.map(({ similarity: _s, ...chunk }) => chunk);
}

async function generateAnswer(
  chunks: CitedChunkEval[],
  question: string,
  promptVariant: string,
): Promise<string> {
  const message = await anthropic.messages.create({
    model: ANSWER_MODEL,
    max_tokens: 1024,
    system: promptVariant,
    messages: [{ role: 'user', content: buildContextPrompt(chunks, question) }],
  });
  return message.content[0]?.type === 'text' ? message.content[0].text : '';
}

async function runCase(
  goldenCase: GoldenCase,
  config: RunConfig,
): Promise<EvalResult> {
  const collectionId = config.collectionIds[goldenCase.collection];
  const embedding = await generateEmbedding(goldenCase.question);
  const retrievedChunks = await retrieveChunks(
    embedding,
    collectionId,
    config.topK,
  );
  const answer = await generateAnswer(
    retrievedChunks,
    goldenCase.question,
    config.promptVariant,
  );
  return {
    ...goldenCase,
    retrievedChunks,
    answer,
    topK: config.topK,
    promptVariant: config.promptVariant,
  };
}

export async function runEval(
  configOverrides?: Partial<RunConfig>,
): Promise<EvalResult[]> {
  const golden = JSON.parse(
    readFileSync(resolve(FIXTURES_DIR, 'golden.json'), 'utf-8'),
  ) as GoldenFile;

  const config: RunConfig = {
    topK: 6,
    promptVariant: BASELINE_PROMPT,
    variantLabel: 'baseline',
    collectionIds: golden.collectionIds,
    ...configOverrides,
  };

  console.log(
    `Running eval: variant=${config.variantLabel}, topK=${config.topK}, cases=${golden.cases.length}`,
  );

  const results: EvalResult[] = [];
  const batches = batchItems(golden.cases, BATCH_SIZE);

  for (const [i, batch] of batches.entries()) {
    const batchResults = await Promise.all(
      batch.map((c) => runCase(c, config)),
    );
    results.push(...batchResults);
    writeFileSync(
      resolve(FIXTURES_DIR, 'results-latest.json'),
      JSON.stringify(results, null, 2),
    );
    process.stdout.write(
      `\rBatch ${i + 1}/${batches.length} complete (${results.length} cases)`,
    );
  }

  console.log('\nEval complete.');
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runEval()
    .catch(console.error)
    .finally(() => closePool());
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run --config scripts/eval/vitest.config.ts
```

Expected:

```
PASS  __tests__/runEval.test.ts
  batchItems
    + splits an array into batches of the given size
    + puts the remainder in the final batch
    + returns empty array for empty input
    + returns one batch when size >= length
  buildContextPrompt
    + numbers chunks starting at 1
    + includes the question at the end
    + includes chunk content
```

- [ ] **Step 5: Commit**

```bash
git add scripts/eval/run-eval.ts scripts/eval/__tests__/runEval.test.ts
git commit -m "feat(eval): add RAG pipeline runner with batched case execution"
```

---

## Task 4: Judge

**Files:**

- Create: `scripts/eval/__tests__/judge.test.ts`
- Create: `scripts/eval/judge.ts`

- [ ] **Step 1: Write failing tests for parseJudgeResponse**

Create `scripts/eval/__tests__/judge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { parseJudgeResponse } from '../judge.js';

const VALID_SCORES = {
  faithfulness: 4,
  answerRelevance: 5,
  citationAccuracy: 3,
  completeness: 4,
  contextRecall: 4,
};

describe('parseJudgeResponse', () => {
  it('parses a valid JSON judge response', () => {
    const text = JSON.stringify({
      scores: VALID_SCORES,
      reasoning: 'Good answer with minor citation gaps.',
    });
    const result = parseJudgeResponse(text);
    expect(result).not.toBeNull();
    expect(result?.scores.faithfulness).toBe(4);
    expect(result?.scores.answerRelevance).toBe(5);
    expect(result?.reasoning).toBe('Good answer with minor citation gaps.');
  });

  it('extracts JSON embedded in surrounding prose', () => {
    const text = `Here is my evaluation:\n${JSON.stringify({ scores: VALID_SCORES, reasoning: 'ok' })}`;
    const result = parseJudgeResponse(text);
    expect(result?.scores.faithfulness).toBe(4);
  });

  it('returns null for non-JSON input', () => {
    expect(parseJudgeResponse('sorry I cannot score this')).toBeNull();
  });

  it('returns null when scores object is missing', () => {
    expect(parseJudgeResponse(JSON.stringify({ reasoning: 'ok' }))).toBeNull();
  });

  it('returns null when a score is a string instead of number', () => {
    const text = JSON.stringify({
      scores: { ...VALID_SCORES, faithfulness: '4' },
      reasoning: 'ok',
    });
    expect(parseJudgeResponse(text)).toBeNull();
  });

  it('returns null when a score key is missing', () => {
    const { faithfulness: _f, ...noFaithfulness } = VALID_SCORES;
    const text = JSON.stringify({ scores: noFaithfulness, reasoning: 'ok' });
    expect(parseJudgeResponse(text)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run --config scripts/eval/vitest.config.ts
```

Expected: FAIL -- `judge.js` not found.

- [ ] **Step 3: Create `scripts/eval/judge.ts`**

```ts
/** Scores eval results across 5 RAG dimensions using Claude Opus. */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import type { DimensionScores, EvalResult, ScoredResult } from './lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, 'fixtures');
const JUDGE_MODEL = 'claude-opus-4-8';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildJudgePrompt(result: EvalResult): string {
  const chunksText = result.retrievedChunks
    .map(
      (c, i) =>
        `[${i + 1}] (From "${c.filename}", chunk ${c.chunk_index}):\n${c.content}`,
    )
    .join('\n\n');

  return `You are evaluating a RAG system's answer quality. Score each dimension 1-5 (5 = perfect).

QUESTION: ${result.question}
REFERENCE ANSWER: ${result.referenceAnswer}
RETRIEVED CHUNKS:
${chunksText}
SYSTEM ANSWER: ${result.answer}

Score these dimensions:
- faithfulness: Does every claim come from the retrieved chunks? No hallucination?
- answerRelevance: Does the answer directly address the question?
- citationAccuracy: Are [n] markers used correctly and matched to the right chunks?
- completeness: Does the answer cover all relevant info present in the chunks?
- contextRecall: Did the retrieved chunks actually contain what was needed to answer?

Respond with JSON only:
{
  "scores": { "faithfulness": n, "answerRelevance": n, "citationAccuracy": n, "completeness": n, "contextRecall": n },
  "reasoning": "one sentence per dimension explaining the score"
}`;
}

export function parseJudgeResponse(
  text: string,
): { scores: DimensionScores; reasoning: string } | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      scores?: Record<string, unknown>;
      reasoning?: unknown;
    };

    const s = parsed.scores;
    if (!s) return null;

    const {
      faithfulness,
      answerRelevance,
      citationAccuracy,
      completeness,
      contextRecall,
    } = s;
    if (
      typeof faithfulness !== 'number' ||
      typeof answerRelevance !== 'number' ||
      typeof citationAccuracy !== 'number' ||
      typeof completeness !== 'number' ||
      typeof contextRecall !== 'number'
    ) {
      return null;
    }

    return {
      scores: {
        faithfulness,
        answerRelevance,
        citationAccuracy,
        completeness,
        contextRecall,
      },
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  } catch {
    return null;
  }
}

function computeMean(scores: DimensionScores): number {
  const values = Object.values(scores);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const FALLBACK_SCORES: DimensionScores = {
  faithfulness: 1,
  answerRelevance: 1,
  citationAccuracy: 1,
  completeness: 1,
  contextRecall: 1,
};

async function judgeCase(result: EvalResult): Promise<ScoredResult> {
  const message = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: buildJudgePrompt(result) }],
  });

  const text =
    message.content[0]?.type === 'text' ? message.content[0].text : '';
  const parsed = parseJudgeResponse(text);
  const scores = parsed?.scores ?? FALLBACK_SCORES;

  return {
    ...result,
    scores,
    meanScore: computeMean(scores),
    judgeReasoning: parsed?.reasoning ?? 'Parse error',
  };
}

export async function judgeResults(
  results?: EvalResult[],
): Promise<ScoredResult[]> {
  const toJudge =
    results ??
    (JSON.parse(
      readFileSync(resolve(FIXTURES_DIR, 'results-latest.json'), 'utf-8'),
    ) as EvalResult[]);

  console.log(`Judging ${toJudge.length} results with ${JUDGE_MODEL}`);

  const scored: ScoredResult[] = [];
  for (const [i, result] of toJudge.entries()) {
    const s = await judgeCase(result);
    scored.push(s);
    process.stdout.write(`\r${i + 1}/${toJudge.length} judged`);
  }

  console.log();
  writeFileSync(
    resolve(FIXTURES_DIR, 'scores-latest.json'),
    JSON.stringify(scored, null, 2),
  );
  return scored;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  judgeResults().catch(console.error);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run --config scripts/eval/vitest.config.ts
```

Expected:

```
PASS  __tests__/judge.test.ts
  parseJudgeResponse
    + parses a valid JSON judge response
    + extracts JSON embedded in surrounding prose
    + returns null for non-JSON input
    + returns null when scores object is missing
    + returns null when a score is a string instead of number
    + returns null when a score key is missing
```

- [ ] **Step 5: Commit**

```bash
git add scripts/eval/judge.ts scripts/eval/__tests__/judge.test.ts
git commit -m "feat(eval): add Opus judge with 5-dimension scoring"
```

---

## Task 5: Reporter

**Files:**

- Create: `scripts/eval/__tests__/report.test.ts`
- Create: `scripts/eval/report.ts`

- [ ] **Step 1: Write failing tests for formatBar, computeDimensionMeans, and formatReport**

Create `scripts/eval/__tests__/report.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { DimensionScores, ScoredResult } from '../lib/types.js';
import { computeDimensionMeans, formatBar, formatReport } from '../report.js';

function makeResult(
  scores: Partial<Record<string, number>> = {},
): ScoredResult {
  const defaultScores = {
    faithfulness: 4,
    answerRelevance: 5,
    citationAccuracy: 4,
    completeness: 4,
    contextRecall: 4,
  };
  const merged = { ...defaultScores, ...scores };
  const mean = Object.values(merged).reduce((a, b) => a + b, 0) / 5;
  return {
    id: 'test-1',
    collection: 'valve',
    question: 'What is the policy?',
    referenceAnswer: 'ref',
    generatorModel: 'claude-haiku-4-5-20251001',
    retrievedChunks: [],
    answer: 'The policy is [1].',
    topK: 6,
    promptVariant: 'baseline',
    scores: merged as DimensionScores,
    meanScore: mean,
    judgeReasoning: 'ok',
  };
}

describe('formatBar', () => {
  it('fills all slots for score 5', () => {
    expect(formatBar(5, 20)).toBe('#'.repeat(20));
  });

  it('fills no slots for score 0', () => {
    expect(formatBar(0, 20)).toBe('.'.repeat(20));
  });

  it('fills half for score 2.5 on width 20', () => {
    expect(formatBar(2.5, 20)).toBe('#'.repeat(10) + '.'.repeat(10));
  });
});

describe('computeDimensionMeans', () => {
  it('computes correct means across two results', () => {
    const results = [
      makeResult({ faithfulness: 4, answerRelevance: 5 }),
      makeResult({ faithfulness: 2, answerRelevance: 3 }),
    ];
    const means = computeDimensionMeans(results);
    expect(means.faithfulness).toBe(3);
    expect(means.answerRelevance).toBe(4);
  });

  it('handles a single result', () => {
    const means = computeDimensionMeans([makeResult({ faithfulness: 4.5 })]);
    expect(means.faithfulness).toBe(4.5);
  });
});

describe('formatReport', () => {
  it('includes the overall mean', () => {
    const report = formatReport([makeResult()], 'test-run');
    expect(report).toContain('Overall Mean:');
  });

  it('shows NOT MET when mean is below 4.8', () => {
    const report = formatReport([makeResult({ faithfulness: 3 })]);
    expect(report).toContain('NOT MET');
  });

  it('shows MET when all scores are 5', () => {
    const perfect = makeResult({
      faithfulness: 5,
      answerRelevance: 5,
      citationAccuracy: 5,
      completeness: 5,
      contextRecall: 5,
    });
    const report = formatReport([perfect]);
    expect(report).toContain('MET');
    expect(report).not.toContain('NOT MET');
  });

  it('lists the variant label and topK', () => {
    const report = formatReport([makeResult()], 'my-variant');
    expect(report).toContain('my-variant');
    expect(report).toContain('topK: 6');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run --config scripts/eval/vitest.config.ts
```

Expected: FAIL -- `report.js` not found.

- [ ] **Step 3: Create `scripts/eval/report.ts`**

```ts
/** Prints a console summary of scored eval results. Supports --compare for diffs. */
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import type { DimensionScores, ScoredResult } from './lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, 'fixtures');
const TARGET_SCORE = 4.8;
const BAR_WIDTH = 20;

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  faithfulness: 'Faithfulness      ',
  answerRelevance: 'Answer Relevance  ',
  citationAccuracy: 'Citation Accuracy ',
  completeness: 'Completeness      ',
  contextRecall: 'Context Recall    ',
};

export function formatBar(score: number, width: number): string {
  const filled = Math.round((score / 5) * width);
  return '#'.repeat(filled) + '.'.repeat(width - filled);
}

export function computeDimensionMeans(
  results: ScoredResult[],
): DimensionScores {
  const keys = Object.keys(DIMENSION_LABELS) as (keyof DimensionScores)[];
  const sums: Record<string, number> = Object.fromEntries(
    keys.map((k) => [k, 0]),
  );
  for (const r of results) {
    for (const k of keys) sums[k]! += r.scores[k];
  }
  return Object.fromEntries(
    keys.map((k) => [k, sums[k]! / results.length]),
  ) as DimensionScores;
}

export function formatReport(
  results: ScoredResult[],
  variantLabel?: string,
): string {
  const means = computeDimensionMeans(results);
  const keys = Object.keys(DIMENSION_LABELS) as (keyof DimensionScores)[];
  const overallMean = keys.reduce((sum, k) => sum + means[k], 0) / keys.length;
  const label = variantLabel ?? 'unknown';
  const topK = results[0]?.topK ?? '?';

  const dimensionLines = keys
    .map(
      (k) =>
        `  ${DIMENSION_LABELS[k]} ${means[k].toFixed(1)}  [${formatBar(means[k], BAR_WIDTH)}]`,
    )
    .join('\n');

  const bottom5 = [...results]
    .sort((a, b) => a.meanScore - b.meanScore)
    .slice(0, 5);
  const worstLines = bottom5
    .map(
      (r) =>
        `  [${r.collection}] "${r.question.slice(0, 55)}"  ${r.meanScore.toFixed(1)}`,
    )
    .join('\n');

  const distribution = [1, 2, 3, 4, 5]
    .map(
      (star) =>
        `${star}(${results.filter((r) => Math.round(r.meanScore) === star).length})`,
    )
    .join(' ');

  const targetMet = overallMean >= TARGET_SCORE ? 'MET' : 'NOT MET';

  return [
    'PolicyPilot Eval Report',
    '-'.repeat(41),
    `Run: ${label} | topK: ${topK} | Cases: ${results.length}`,
    '',
    'Dimension Scores (mean across all cases):',
    dimensionLines,
    '',
    `Overall Mean: ${overallMean.toFixed(2)}  [TARGET: ${TARGET_SCORE} - ${targetMet}]`,
    '',
    'Lowest performers (bottom 5 cases):',
    worstLines,
    '',
    `Distribution: ${distribution}`,
    '-'.repeat(41),
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const compareIdx = args.indexOf('--compare');
  const results = JSON.parse(
    readFileSync(resolve(FIXTURES_DIR, 'scores-latest.json'), 'utf-8'),
  ) as ScoredResult[];
  console.log(formatReport(results));

  if (compareIdx !== -1 && args[compareIdx + 1]) {
    const otherResults = JSON.parse(
      readFileSync(resolve(args[compareIdx + 1]!), 'utf-8'),
    ) as ScoredResult[];
    console.log('\n--- Comparison ---\n');
    console.log(formatReport(otherResults));
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run --config scripts/eval/vitest.config.ts
```

Expected:

```
PASS  __tests__/report.test.ts
  formatBar
    + fills all slots for score 5
    + fills no slots for score 0
    + fills half for score 2.5 on width 20
  computeDimensionMeans
    + computes correct means across two results
    + handles a single result
  formatReport
    + includes the overall mean
    + shows NOT MET when mean is below 4.8
    + shows MET when all scores are 5
    + lists the variant label and topK
```

- [ ] **Step 5: Commit**

```bash
git add scripts/eval/report.ts scripts/eval/__tests__/report.test.ts
git commit -m "feat(eval): add console reporter with dimension bars and --compare flag"
```

---

## Task 6: Improvement loop

**Files:**

- Create: `scripts/eval/__tests__/improve.test.ts`
- Create: `scripts/eval/improve.ts`

- [ ] **Step 1: Write failing tests for selectLever**

Create `scripts/eval/__tests__/improve.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { selectLever } from '../improve.js';
import type { DimensionScores } from '../lib/types.js';

const HIGH: DimensionScores = {
  faithfulness: 4.8,
  answerRelevance: 4.8,
  citationAccuracy: 4.8,
  completeness: 4.8,
  contextRecall: 4.8,
};

describe('selectLever', () => {
  it('returns prompt when faithfulness is lowest', () => {
    const { lever, failingDimension } = selectLever({
      ...HIGH,
      faithfulness: 3.0,
    });
    expect(lever).toBe('prompt');
    expect(failingDimension).toBe('faithfulness');
  });

  it('returns prompt when citationAccuracy is lowest', () => {
    const { lever, failingDimension } = selectLever({
      ...HIGH,
      citationAccuracy: 2.5,
    });
    expect(lever).toBe('prompt');
    expect(failingDimension).toBe('citationAccuracy');
  });

  it('returns prompt when completeness is lowest', () => {
    const { lever, failingDimension } = selectLever({
      ...HIGH,
      completeness: 3.1,
    });
    expect(lever).toBe('prompt');
    expect(failingDimension).toBe('completeness');
  });

  it('returns topK when contextRecall is lowest', () => {
    const { lever, failingDimension } = selectLever({
      ...HIGH,
      contextRecall: 2.9,
    });
    expect(lever).toBe('topK');
    expect(failingDimension).toBe('contextRecall');
  });

  it('returns topK when answerRelevance is lowest', () => {
    const { lever, failingDimension } = selectLever({
      ...HIGH,
      answerRelevance: 3.0,
    });
    expect(lever).toBe('topK');
    expect(failingDimension).toBe('answerRelevance');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run --config scripts/eval/vitest.config.ts
```

Expected: FAIL -- `improve.js` not found.

- [ ] **Step 3: Create `scripts/eval/improve.ts`**

```ts
/** Iterative improvement loop: tunes prompts and topK until mean score >= 4.8. */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { judgeResults } from './judge.js';
import { closePool } from './lib/db.js';
import type {
  DimensionScores,
  GoldenFile,
  Recommendations,
  RunConfig,
  ScoredResult,
} from './lib/types.js';
import { computeDimensionMeans, formatReport } from './report.js';
import { runEval } from './run-eval.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, 'fixtures');
const TARGET_SCORE = 4.8;
const MAX_ITERATIONS = 10;
const TOP_K_CANDIDATES = [4, 6, 8, 10, 12];
const JUDGE_MODEL = 'claude-opus-4-8';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type Lever = 'prompt' | 'topK';

const PROMPT_DIMENSIONS: (keyof DimensionScores)[] = [
  'faithfulness',
  'citationAccuracy',
  'completeness',
];

export function selectLever(means: DimensionScores): {
  lever: Lever;
  failingDimension: keyof DimensionScores;
} {
  const ranked = (
    Object.entries(means) as [keyof DimensionScores, number][]
  ).sort(([, a], [, b]) => a - b);
  const failingDimension = ranked[0]![0];
  const lever: Lever = PROMPT_DIMENSIONS.includes(failingDimension)
    ? 'prompt'
    : 'topK';
  return { lever, failingDimension };
}

function computeRunMean(results: ScoredResult[]): number {
  return results.reduce((sum, r) => sum + r.meanScore, 0) / results.length;
}

async function generatePromptCandidates(
  currentPrompt: string,
  failingDimension: keyof DimensionScores,
  failingCases: ScoredResult[],
): Promise<string[]> {
  const examples = failingCases
    .slice(0, 3)
    .map(
      (c) =>
        `Q: ${c.question}\nAnswer: ${c.answer.slice(0, 200)}\nIssue: ${c.judgeReasoning}`,
    )
    .join('\n\n');

  const message = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 1200,
    messages: [
      {
        role: 'user',
        content: `You are improving a RAG system prompt. The current prompt scores poorly on "${failingDimension}".

Current prompt:
${currentPrompt}

Failing examples:
${examples}

Generate 2 improved system prompt variants that address the "${failingDimension}" weakness. Each must be a complete, self-contained system prompt replacement.

Respond with JSON only: [{ "label": "v-desc", "prompt": "full prompt text" }, ...]`,
      },
    ],
  });

  const text =
    message.content[0]?.type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      label: string;
      prompt: string;
    }>;
    return parsed.map((p) => p.prompt).filter(Boolean);
  } catch {
    return [];
  }
}

async function tryPromptVariants(
  baseConfig: RunConfig,
  candidates: string[],
  currentScore: number,
  round: number,
): Promise<{
  bestPrompt: string;
  bestScore: number;
  scoreDelta: number;
  bestScored: ScoredResult[];
}> {
  let bestPrompt = baseConfig.promptVariant;
  let bestScore = currentScore;
  let bestScored: ScoredResult[] = [];

  for (const [i, candidate] of candidates.entries()) {
    const results = await runEval({
      ...baseConfig,
      promptVariant: candidate,
      variantLabel: `r${round}-prompt-v${i + 1}`,
    });
    const scored = await judgeResults(results);
    const score = computeRunMean(scored);
    if (score > bestScore) {
      bestScore = score;
      bestPrompt = candidate;
      bestScored = scored;
    }
  }

  return {
    bestPrompt,
    bestScore,
    scoreDelta: bestScore - currentScore,
    bestScored,
  };
}

async function tryTopKCandidates(
  baseConfig: RunConfig,
  currentScore: number,
): Promise<{
  bestTopK: number;
  bestScore: number;
  scoreDelta: number;
  bestScored: ScoredResult[];
}> {
  let bestTopK = baseConfig.topK;
  let bestScore = currentScore;
  let bestScored: ScoredResult[] = [];

  for (const topK of TOP_K_CANDIDATES) {
    if (topK === baseConfig.topK) continue;
    const results = await runEval({
      ...baseConfig,
      topK,
      variantLabel: `topk-${topK}`,
    });
    const scored = await judgeResults(results);
    const score = computeRunMean(scored);
    if (score > bestScore) {
      bestScore = score;
      bestTopK = topK;
      bestScored = scored;
      break;
    }
  }

  return {
    bestTopK,
    bestScore,
    scoreDelta: bestScore - currentScore,
    bestScored,
  };
}

export async function runImprovementLoop(): Promise<void> {
  const golden = JSON.parse(
    readFileSync(resolve(FIXTURES_DIR, 'golden.json'), 'utf-8'),
  ) as GoldenFile;

  let currentResults = await runEval({ variantLabel: 'baseline' });
  let currentScored = await judgeResults(currentResults);
  let currentScore = computeRunMean(currentScored);
  let currentPrompt = currentResults[0]?.promptVariant ?? '';
  let currentTopK = currentResults[0]?.topK ?? 6;

  const changeLog: Recommendations['changeLog'] = [];

  console.log(
    `\nBaseline score: ${currentScore.toFixed(2)} (target: ${TARGET_SCORE})`,
  );
  console.log(formatReport(currentScored, 'baseline'));

  for (let round = 1; round <= MAX_ITERATIONS; round++) {
    if (currentScore >= TARGET_SCORE) {
      console.log(`\nTarget reached after ${round - 1} rounds.`);
      break;
    }

    console.log(`\n--- Round ${round}/${MAX_ITERATIONS} ---`);
    const means = computeDimensionMeans(currentScored);
    const { lever, failingDimension } = selectLever(means);
    console.log(
      `Weakest: ${failingDimension} (${means[failingDimension].toFixed(2)}) -> lever: ${lever}`,
    );

    const baseConfig: RunConfig = {
      topK: currentTopK,
      promptVariant: currentPrompt,
      variantLabel: `round-${round}`,
      collectionIds: golden.collectionIds,
    };

    if (lever === 'prompt') {
      const failingCases = currentScored.filter(
        (r) => r.scores[failingDimension] < 3.5,
      );
      const candidates = await generatePromptCandidates(
        currentPrompt,
        failingDimension,
        failingCases,
      );

      if (candidates.length === 0) {
        console.log('No prompt candidates generated -- skipping round');
        continue;
      }

      const { bestPrompt, bestScore, scoreDelta, bestScored } =
        await tryPromptVariants(baseConfig, candidates, currentScore, round);

      if (scoreDelta > 0) {
        currentPrompt = bestPrompt;
        currentScore = bestScore;
        currentScored = bestScored;
        changeLog.push({
          round,
          change: `prompt: improved ${failingDimension}`,
          scoreDelta,
        });
        console.log(
          `Score +${scoreDelta.toFixed(3)} -> ${currentScore.toFixed(2)}`,
        );
      } else {
        console.log('No improvement from prompt variants');
      }
    } else {
      const { bestTopK, bestScore, scoreDelta, bestScored } =
        await tryTopKCandidates(baseConfig, currentScore);

      if (scoreDelta > 0) {
        currentTopK = bestTopK;
        currentScore = bestScore;
        currentScored = bestScored;
        changeLog.push({
          round,
          change: `topK ${baseConfig.topK}->${bestTopK}`,
          scoreDelta,
        });
        console.log(
          `Score +${scoreDelta.toFixed(3)} -> ${currentScore.toFixed(2)}`,
        );
      } else {
        console.log('No improvement from topK tuning');
      }
    }
  }

  const recommendations: Recommendations = {
    finalMeanScore: currentScore,
    bestTopK: currentTopK,
    bestPrompt: currentPrompt,
    iterationsRun: changeLog.length,
    dimensionScores: computeDimensionMeans(currentScored),
    changeLog,
  };

  writeFileSync(
    resolve(FIXTURES_DIR, 'recommendations.json'),
    JSON.stringify(recommendations, null, 2),
  );

  console.log(`\nFinal score: ${currentScore.toFixed(2)}`);
  console.log(formatReport(currentScored, `final-topK${currentTopK}`));
  console.log('\nRecommendations written to fixtures/recommendations.json');
  console.log('Apply manually:');
  console.log('  apps/server/src/prompts/qa-system.ts  <-- bestPrompt');
  console.log(
    `  apps/server/src/services/retrieval.service.ts  <-- topK: ${currentTopK}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runImprovementLoop()
    .catch(console.error)
    .finally(() => closePool());
}
```

- [ ] **Step 4: Run the full test suite to confirm all tests pass**

```bash
npx vitest run --config scripts/eval/vitest.config.ts
```

Expected: all tests across all `__tests__/` files pass. Verify count matches:

- `embed.test.ts`: 1 test
- `generateGolden.test.ts`: 7 tests
- `runEval.test.ts`: 7 tests
- `judge.test.ts`: 6 tests
- `report.test.ts`: 8 tests
- `improve.test.ts`: 5 tests

Total: 34 tests, all passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/eval/improve.ts scripts/eval/__tests__/improve.test.ts
git commit -m "feat(eval): add improvement loop with prompt and topK tuning"
```

---

## Execution order (after implementation complete)

```bash
# Step 1: Generate golden set (run once, or when demo handbooks change)
npx tsx scripts/eval/generate-golden.ts

# Step 2: Run the pipeline against the golden set
npx tsx scripts/eval/run-eval.ts

# Step 3: Score results with Opus
npx tsx scripts/eval/judge.ts

# Step 4: View the report
npx tsx scripts/eval/report.ts

# Step 5: Run the improvement loop until 4.8 or 10 rounds
npx tsx scripts/eval/improve.ts

# After improve.ts completes, apply recommendations manually:
# - Copy bestPrompt to apps/server/src/prompts/qa-system.ts (QA_SYSTEM_PROMPT)
# - Update topK in apps/server/src/services/retrieval.service.ts (searchChunks call, line ~116)
```

---

## Notes for the implementer

- All scripts load env from `apps/server/.env` via dotenv at startup. Ensure `DATABASE_URL`, `ANTHROPIC_API_KEY`, and `OPEN_AI_API_KEY` are set there.
- `generate-golden.ts` makes ~4 Anthropic API calls per chunk (Haiku gen, Sonnet gen, Haiku quality x2). With ~50 qualifying chunks expect ~200 API calls and 5-10 minutes runtime.
- `improve.ts` may take 30-90 minutes per full run (each round runs eval + judge = N\*2 API calls). The 10-round cap is a hard ceiling.
- `golden.json` is committed to the repo and is the stable regression baseline. Regenerate only when demo handbook content changes.
- The improvement loop never writes to source files. Apply `bestPrompt` and `bestTopK` from `recommendations.json` manually after reviewing the change log.
