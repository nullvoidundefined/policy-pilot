import { describe, expect, it } from 'vitest';

import { selectLever } from '../improve.js';
import type { DimensionScores } from '../lib/types.js';

describe('selectLever', () => {
  it('returns prompt lever when faithfulness is lowest', () => {
    const means: DimensionScores = {
      faithfulness: 3.0,
      answerRelevance: 4.5,
      citationAccuracy: 4.2,
      completeness: 4.0,
      contextRecall: 4.3,
    };
    const { lever, failingDimension } = selectLever(means);
    expect(lever).toBe('prompt');
    expect(failingDimension).toBe('faithfulness');
  });

  it('returns prompt lever when citationAccuracy is lowest', () => {
    const means: DimensionScores = {
      faithfulness: 4.5,
      answerRelevance: 4.4,
      citationAccuracy: 3.1,
      completeness: 4.2,
      contextRecall: 4.0,
    };
    const { lever, failingDimension } = selectLever(means);
    expect(lever).toBe('prompt');
    expect(failingDimension).toBe('citationAccuracy');
  });

  it('returns topK lever when contextRecall is lowest', () => {
    const means: DimensionScores = {
      faithfulness: 4.5,
      answerRelevance: 4.4,
      citationAccuracy: 4.2,
      completeness: 4.3,
      contextRecall: 3.0,
    };
    const { lever, failingDimension } = selectLever(means);
    expect(lever).toBe('topK');
    expect(failingDimension).toBe('contextRecall');
  });

  it('returns topK lever when answerRelevance is lowest', () => {
    const means: DimensionScores = {
      faithfulness: 4.5,
      answerRelevance: 3.2,
      citationAccuracy: 4.2,
      completeness: 4.3,
      contextRecall: 4.0,
    };
    const { lever, failingDimension } = selectLever(means);
    expect(lever).toBe('topK');
    expect(failingDimension).toBe('answerRelevance');
  });

  it('returns prompt lever when completeness is lowest', () => {
    const means: DimensionScores = {
      faithfulness: 4.5,
      answerRelevance: 4.4,
      citationAccuracy: 4.2,
      completeness: 3.0,
      contextRecall: 4.3,
    };
    const { lever, failingDimension } = selectLever(means);
    expect(lever).toBe('prompt');
    expect(failingDimension).toBe('completeness');
  });
});
