/** Scores EvalResults across 5 RAG quality dimensions using Claude Opus as judge. */
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { closePool } from './lib/db.js';
import type { DimensionScores, EvalResult, ScoredResult } from './lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../apps/server/.env') });

const OPUS_MODEL = 'claude-opus-4-8';
const RESULTS_PATH = resolve(__dirname, 'fixtures/results-latest.json');
const SCORES_PATH = resolve(__dirname, 'fixtures/scores-latest.json');

interface JudgeResponse {
  scores: DimensionScores;
  reasoning: string;
}

function buildJudgePrompt(result: EvalResult): string {
  const chunks = result.retrievedChunks
    .map((c, i) => `[${i + 1}] (${c.filename}):\n${c.content}`)
    .join('\n\n---\n\n');

  return `You are evaluating a RAG system's answer quality. Score each dimension 1-5 (5 = perfect).

QUESTION: ${result.question}

REFERENCE ANSWER: ${result.referenceAnswer}

RETRIEVED CHUNKS:
${chunks}

SYSTEM ANSWER: ${result.answer}

Score these dimensions:
- faithfulness: Does every claim in the answer come from the retrieved chunks? No hallucination?
- answerRelevance: Does the answer directly address the question asked?
- citationAccuracy: Are [n] citation markers used correctly and matched to the right chunks?
- completeness: Does the answer cover all relevant information present in the chunks?
- contextRecall: Did the retrieved chunks actually contain what was needed to answer the question?

Respond with JSON only (no markdown, no explanation outside the JSON):
{
  "scores": {
    "faithfulness": <1-5>,
    "answerRelevance": <1-5>,
    "citationAccuracy": <1-5>,
    "completeness": <1-5>,
    "contextRecall": <1-5>
  },
  "reasoning": "<one sentence per dimension, separated by | >"
}`;
}

export function parseJudgeResponse(text: string): JudgeResponse | null {
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) return null;

  try {
    const parsed = JSON.parse(
      trimmed.slice(jsonStart, jsonEnd + 1),
    ) as JudgeResponse;
    const { scores } = parsed;
    const required: (keyof DimensionScores)[] = [
      'faithfulness',
      'answerRelevance',
      'citationAccuracy',
      'completeness',
      'contextRecall',
    ];
    for (const key of required) {
      if (typeof scores[key] !== 'number' || scores[key] < 1 || scores[key] > 5)
        return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function computeMeanScore(scores: DimensionScores): number {
  const values = Object.values(scores) as number[];
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

async function judgeOne(
  client: Anthropic,
  result: EvalResult,
): Promise<ScoredResult> {
  const response = await client.messages.create({
    model: OPUS_MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: buildJudgePrompt(result) }],
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text : '';
  const parsed = parseJudgeResponse(text);

  const scores: DimensionScores = parsed?.scores ?? {
    faithfulness: 1,
    answerRelevance: 1,
    citationAccuracy: 1,
    completeness: 1,
    contextRecall: 1,
  };

  return {
    ...result,
    scores,
    meanScore: computeMeanScore(scores),
    judgeReasoning: parsed?.reasoning ?? 'parse error',
  };
}

export async function judgeResults(
  results?: EvalResult[],
): Promise<ScoredResult[]> {
  const input =
    results ??
    (JSON.parse(readFileSync(RESULTS_PATH, 'utf-8')) as EvalResult[]);

  if (!results && !existsSync(RESULTS_PATH)) {
    throw new Error(
      `Results file not found at ${RESULTS_PATH}. Run run-eval.ts first.`,
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const scored: ScoredResult[] = [];

  for (let i = 0; i < input.length; i++) {
    const result = input[i]!;
    console.log(
      `Judging ${i + 1}/${input.length}: ${result.question.slice(0, 60)}...`,
    );
    const scoredResult = await judgeOne(client, result);
    scored.push(scoredResult);
    writeFileSync(SCORES_PATH, JSON.stringify(scored, null, 2));
  }

  console.log(`\nWrote ${scored.length} scored results to ${SCORES_PATH}`);
  return scored;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  judgeResults()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => closePool());
}
