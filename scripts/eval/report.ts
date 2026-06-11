/** Formats and prints a summary of scored eval results to the console. */
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import type { DimensionScores, ScoredResult } from './lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCORES_PATH = resolve(__dirname, 'fixtures/scores-latest.json');
const TARGET_SCORE = 4.8;
const BAR_WIDTH = 20;
const BOTTOM_PERFORMERS_COUNT = 5;

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
  if (results.length === 0) {
    return {
      faithfulness: 0,
      answerRelevance: 0,
      citationAccuracy: 0,
      completeness: 0,
      contextRecall: 0,
    };
  }

  const sums: DimensionScores = {
    faithfulness: 0,
    answerRelevance: 0,
    citationAccuracy: 0,
    completeness: 0,
    contextRecall: 0,
  };

  for (const result of results) {
    for (const key of Object.keys(sums) as (keyof DimensionScores)[]) {
      sums[key] += result.scores[key];
    }
  }

  const means = {} as DimensionScores;
  for (const key of Object.keys(sums) as (keyof DimensionScores)[]) {
    means[key] = sums[key] / results.length;
  }
  return means;
}

export function formatReport(
  results: ScoredResult[],
  variantLabel?: string,
): string {
  const label =
    variantLabel ?? results[0]?.promptVariant?.slice(0, 20) ?? 'unknown';
  const dimensionMeans = computeDimensionMeans(results);
  const overallMean =
    (Object.values(dimensionMeans) as number[]).reduce((a, b) => a + b, 0) / 5;
  const separator = '-'.repeat(41);

  const dimensionLines = (
    Object.keys(DIMENSION_LABELS) as (keyof DimensionScores)[]
  )
    .map((key) => {
      const score = dimensionMeans[key];
      return `  ${DIMENSION_LABELS[key]} ${score.toFixed(1)}  ${formatBar(score, BAR_WIDTH)}`;
    })
    .join('\n');

  const metTargetLabel =
    overallMean >= TARGET_SCORE
      ? `[TARGET: ${TARGET_SCORE} - MET ✓]`
      : `[TARGET: ${TARGET_SCORE} - NOT MET]`;

  const sorted = [...results].sort((a, b) => a.meanScore - b.meanScore);
  const bottomLines = sorted
    .slice(0, BOTTOM_PERFORMERS_COUNT)
    .map(
      (r) =>
        `  [${r.collection}/${r.id}] "${r.question.slice(0, 50)}"  ${r.meanScore.toFixed(1)}`,
    )
    .join('\n');

  const dist = [1, 2, 3, 4, 5].map(
    (n) =>
      `${n}(${results.filter((r) => Math.round(r.meanScore) === n).length})`,
  );

  return [
    'PolicyPilot Eval Report',
    separator,
    `Run: ${label} | topK: ${results[0]?.topK ?? '?'} | Cases: ${results.length}`,
    '',
    'Dimension Scores (mean across all cases):',
    dimensionLines,
    '',
    `Overall Mean: ${overallMean.toFixed(2)}  ${metTargetLabel}`,
    '',
    `Lowest performers (bottom ${BOTTOM_PERFORMERS_COUNT} cases by mean score):`,
    bottomLines,
    '',
    `Distribution: ${dist.join(' ')}`,
    separator,
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(SCORES_PATH)) {
    console.error(
      `Scores file not found at ${SCORES_PATH}. Run judge.ts first.`,
    );
    process.exit(1);
  }
  const results = JSON.parse(
    readFileSync(SCORES_PATH, 'utf-8'),
  ) as ScoredResult[];
  console.log(formatReport(results));
}
