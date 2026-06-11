/** Iteratively tunes prompt and topK to push the eval run mean score above the target. */
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { judgeResults } from './judge.js';
import { closePool } from './lib/db.js';
import type {
  DimensionScores,
  Recommendations,
  ScoredResult,
} from './lib/types.js';
import { computeDimensionMeans, formatReport } from './report.js';
import { BASELINE_SYSTEM_PROMPT, runEval } from './run-eval.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../apps/server/.env') });

const OPUS_MODEL = 'claude-opus-4-8';
const TARGET_SCORE = 4.8;
const MAX_ROUNDS = 10;
const TOP_K_CANDIDATES = [4, 6, 8, 10, 12];
const RECOMMENDATIONS_PATH = resolve(
  __dirname,
  'fixtures/recommendations.json',
);
const SCORES_PATH = resolve(__dirname, 'fixtures/scores-latest.json');

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

async function generatePromptCandidates(
  client: Anthropic,
  currentPrompt: string,
  failingDimension: keyof DimensionScores,
  failingCases: ScoredResult[],
): Promise<string[]> {
  const examples = failingCases
    .slice(0, 3)
    .map(
      (c) =>
        `Q: ${c.question}\nA: ${c.answer}\nScore: ${c.scores[failingDimension]}`,
    )
    .join('\n\n');

  const response = await client.messages.create({
    model: OPUS_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are improving a RAG system prompt to improve the dimension: ${failingDimension}.

Current system prompt:
${currentPrompt}

Failing cases (low ${failingDimension} scores):
${examples}

Generate 2 improved system prompt variants that specifically target improving ${failingDimension}.
Each variant should be a complete system prompt (not just the change).

Respond with JSON only:
[
  { "variant": "<complete system prompt 1>" },
  { "variant": "<complete system prompt 2>" }
]`,
      },
    ],
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text : '[]';
  try {
    const parsed = JSON.parse(text) as Array<{ variant: string }>;
    return parsed.map((p) => p.variant).filter(Boolean);
  } catch {
    return [];
  }
}

function computeRunMean(scored: ScoredResult[]): number {
  if (scored.length === 0) return 0;
  return scored.reduce((sum, r) => sum + r.meanScore, 0) / scored.length;
}

async function tryPromptVariants(
  client: Anthropic,
  currentPrompt: string,
  failingDimension: keyof DimensionScores,
  currentScored: ScoredResult[],
  topK: number,
): Promise<{ bestPrompt: string; bestMean: number }> {
  const failingCases = [...currentScored]
    .sort((a, b) => a.scores[failingDimension] - b.scores[failingDimension])
    .slice(0, 5);

  const candidates = await generatePromptCandidates(
    client,
    currentPrompt,
    failingDimension,
    failingCases,
  );

  let bestPrompt = currentPrompt;
  let bestMean = computeRunMean(currentScored);

  for (const candidate of candidates) {
    const results = await runEval({
      topK,
      promptVariant: candidate,
      variantLabel: 'candidate',
    });
    const scored = await judgeResults(results);
    const mean = computeRunMean(scored);
    if (mean > bestMean) {
      bestMean = mean;
      bestPrompt = candidate;
    }
  }

  return { bestPrompt, bestMean };
}

async function tryTopKVariants(
  currentScored: ScoredResult[],
  currentTopK: number,
  currentPrompt: string,
): Promise<{ bestTopK: number; bestMean: number }> {
  let bestTopK = currentTopK;
  let bestMean = computeRunMean(currentScored);

  for (const topK of TOP_K_CANDIDATES) {
    if (topK === currentTopK) continue;
    const results = await runEval({
      topK,
      promptVariant: currentPrompt,
      variantLabel: 'topk-candidate',
    });
    const scored = await judgeResults(results);
    const mean = computeRunMean(scored);
    if (mean > bestMean) {
      bestMean = mean;
      bestTopK = topK;
      break;
    }
  }

  return { bestTopK, bestMean };
}

export async function runImprovementLoop(): Promise<void> {
  if (!existsSync(SCORES_PATH)) {
    throw new Error(
      `Scores file not found at ${SCORES_PATH}. Run judge.ts first.`,
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let currentScored: ScoredResult[] = JSON.parse(
    readFileSync(SCORES_PATH, 'utf-8'),
  ) as ScoredResult[];
  let currentPrompt = BASELINE_SYSTEM_PROMPT;
  let currentTopK = currentScored[0]?.topK ?? 6;
  let currentMean = computeRunMean(currentScored);

  const changeLog: Recommendations['changeLog'] = [];

  console.log(
    `Starting mean: ${currentMean.toFixed(2)} | Target: ${TARGET_SCORE}`,
  );

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (currentMean >= TARGET_SCORE) {
      console.log(`\nTarget reached after ${round - 1} rounds!`);
      break;
    }

    const means = computeDimensionMeans(currentScored);
    const { lever, failingDimension } = selectLever(means);

    console.log(
      `\nRound ${round}: lowest dimension = ${failingDimension} (${means[failingDimension].toFixed(2)}) -> lever = ${lever}`,
    );

    const prevMean = currentMean;

    if (lever === 'prompt') {
      const { bestPrompt, bestMean } = await tryPromptVariants(
        client,
        currentPrompt,
        failingDimension,
        currentScored,
        currentTopK,
      );
      if (bestMean > currentMean) {
        currentPrompt = bestPrompt;
        currentMean = bestMean;
        changeLog.push({
          round,
          change: `prompt: target ${failingDimension}`,
          scoreDelta: bestMean - prevMean,
        });
      } else {
        changeLog.push({
          round,
          change: `prompt: no improvement (${failingDimension})`,
          scoreDelta: 0,
        });
      }
    } else {
      const { bestTopK, bestMean } = await tryTopKVariants(
        currentScored,
        currentTopK,
        currentPrompt,
      );
      if (bestMean > currentMean) {
        const prevTopK = currentTopK;
        currentTopK = bestTopK;
        currentMean = bestMean;
        changeLog.push({
          round,
          change: `topK ${prevTopK}->${bestTopK}`,
          scoreDelta: bestMean - prevMean,
        });
      } else {
        changeLog.push({
          round,
          change: `topK: no improvement`,
          scoreDelta: 0,
        });
      }
    }

    console.log(`  Mean: ${currentMean.toFixed(2)}`);
    console.log(formatReport(currentScored, `round-${round}`));
  }

  const dimensionScores = computeDimensionMeans(currentScored);
  const recommendations: Recommendations = {
    finalMeanScore: currentMean,
    bestTopK: currentTopK,
    bestPrompt: currentPrompt,
    iterationsRun: changeLog.length,
    dimensionScores,
    changeLog,
  };

  writeFileSync(RECOMMENDATIONS_PATH, JSON.stringify(recommendations, null, 2));
  console.log(`\nRecommendations written to ${RECOMMENDATIONS_PATH}`);
  console.log(
    `Final mean: ${currentMean.toFixed(2)} | Target: ${TARGET_SCORE}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runImprovementLoop()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => closePool());
}
