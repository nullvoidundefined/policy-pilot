import { describe, expect, it } from 'vitest';

import {
  HAIKU_MODEL,
  deduplicateQuestions,
  jaccardSimilarity,
} from '../generate-golden.js';
import type { GoldenCase } from '../lib/types.js';

describe('jaccardSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(
      jaccardSimilarity('the quick brown fox', 'the quick brown fox'),
    ).toBe(1);
  });

  it('returns 0 for completely disjoint strings', () => {
    expect(jaccardSimilarity('apple orange', 'banana grape')).toBe(0);
  });

  it('returns correct score for partial overlap', () => {
    // intersection: {the, brown}, union: {the, quick, brown, fox, slow, dog}
    expect(
      jaccardSimilarity('the quick brown fox', 'the slow brown dog'),
    ).toBeCloseTo(1 / 3, 5);
  });

  it('is case-insensitive', () => {
    expect(jaccardSimilarity('Hello World', 'hello world')).toBe(1);
  });
});

describe('deduplicateQuestions', () => {
  const makeCase = (question: string, id: string): GoldenCase => ({
    id,
    collection: 'valve',
    question,
    referenceAnswer: 'ref',
    generatorModel: HAIKU_MODEL,
  });

  it('keeps all cases when none are similar', () => {
    const cases = [
      makeCase('What is the vacation policy?', 'a'),
      makeCase('How does performance review work?', 'b'),
    ];
    expect(deduplicateQuestions(cases, 0.85)).toHaveLength(2);
  });

  it('removes duplicates above threshold', () => {
    const cases = [
      makeCase('What is the vacation policy at Valve?', 'a'),
      makeCase('What is the vacation policy at Valve?', 'b'),
    ];
    expect(deduplicateQuestions(cases, 0.85)).toHaveLength(1);
  });

  it('keeps the first of two near-duplicates', () => {
    const cases = [
      makeCase('What is the vacation policy at Valve?', 'a'),
      makeCase('What is the vacation policy at Valve?', 'b'),
    ];
    const result = deduplicateQuestions(cases, 0.85);
    expect(result[0]!.id).toBe('a');
  });

  it('returns empty array for empty input', () => {
    expect(deduplicateQuestions([], 0.85)).toHaveLength(0);
  });
});
