import { describe, expect, it } from 'vitest';

import type { ScoredResult } from '../lib/types.js';
import { computeDimensionMeans, formatBar, formatReport } from '../report.js';

function makeScoredResult(overrides: Partial<ScoredResult> = {}): ScoredResult {
  return {
    id: 'test-id',
    collection: 'valve',
    question: 'What is Valve?',
    referenceAnswer: 'A game company.',
    generatorModel: 'claude-haiku-4-5-20251001',
    retrievedChunks: [],
    answer: 'Valve is a game company.',
    topK: 6,
    promptVariant: 'baseline',
    scores: {
      faithfulness: 5,
      answerRelevance: 5,
      citationAccuracy: 5,
      completeness: 5,
      contextRecall: 5,
    },
    meanScore: 5,
    judgeReasoning: 'Perfect.',
    ...overrides,
  };
}

describe('formatBar', () => {
  it('returns all hashes for score 5', () => {
    expect(formatBar(5, 20)).toBe('####################');
  });

  it('returns all dots for score 0', () => {
    expect(formatBar(0, 20)).toBe('....................');
  });

  it('returns mixed bar for score 2.5', () => {
    const bar = formatBar(2.5, 20);
    expect(bar).toHaveLength(20);
    expect(bar).toContain('#');
    expect(bar).toContain('.');
  });
});

describe('computeDimensionMeans', () => {
  it('returns all zeros for empty input', () => {
    const means = computeDimensionMeans([]);
    expect(means.faithfulness).toBe(0);
    expect(means.contextRecall).toBe(0);
  });

  it('computes correct means across results', () => {
    const r1 = makeScoredResult({
      scores: {
        faithfulness: 4,
        answerRelevance: 4,
        citationAccuracy: 4,
        completeness: 4,
        contextRecall: 4,
      },
      meanScore: 4,
    });
    const r2 = makeScoredResult({
      scores: {
        faithfulness: 2,
        answerRelevance: 2,
        citationAccuracy: 2,
        completeness: 2,
        contextRecall: 2,
      },
      meanScore: 2,
    });
    const means = computeDimensionMeans([r1, r2]);
    expect(means.faithfulness).toBe(3);
    expect(means.contextRecall).toBe(3);
  });
});

describe('formatReport', () => {
  it('includes the header', () => {
    expect(formatReport([makeScoredResult()])).toContain(
      'PolicyPilot Eval Report',
    );
  });

  it('shows MET when overall mean >= 4.8', () => {
    const results = [
      makeScoredResult({
        meanScore: 5,
        scores: {
          faithfulness: 5,
          answerRelevance: 5,
          citationAccuracy: 5,
          completeness: 5,
          contextRecall: 5,
        },
      }),
    ];
    expect(formatReport(results)).toContain('MET');
  });

  it('shows NOT MET when overall mean < 4.8', () => {
    const low = makeScoredResult({
      meanScore: 3,
      scores: {
        faithfulness: 3,
        answerRelevance: 3,
        citationAccuracy: 3,
        completeness: 3,
        contextRecall: 3,
      },
    });
    expect(formatReport([low])).toContain('NOT MET');
  });

  it('includes the case count', () => {
    expect(formatReport([makeScoredResult(), makeScoredResult()])).toContain(
      'Cases: 2',
    );
  });
});
