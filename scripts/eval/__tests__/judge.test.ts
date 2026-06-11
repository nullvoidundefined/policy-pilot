import { describe, expect, it } from 'vitest';

import { parseJudgeResponse } from '../judge.js';

describe('parseJudgeResponse', () => {
  const VALID_RESPONSE = JSON.stringify({
    scores: {
      faithfulness: 5,
      answerRelevance: 4,
      citationAccuracy: 3,
      completeness: 4,
      contextRecall: 5,
    },
    reasoning:
      'All claims grounded | Directly answers | Citations correct | Mostly complete | Chunks contained the answer',
  });

  it('parses a valid JSON response', () => {
    const result = parseJudgeResponse(VALID_RESPONSE);
    expect(result).not.toBeNull();
    expect(result!.scores.faithfulness).toBe(5);
    expect(result!.scores.answerRelevance).toBe(4);
  });

  it('extracts JSON from text with surrounding prose', () => {
    const wrapped = `Here is my evaluation:\n${VALID_RESPONSE}\nEnd of evaluation.`;
    const result = parseJudgeResponse(wrapped);
    expect(result).not.toBeNull();
    expect(result!.scores.faithfulness).toBe(5);
  });

  it('returns null for non-JSON text', () => {
    expect(parseJudgeResponse('I cannot evaluate this')).toBeNull();
  });

  it('returns null when a score is out of range', () => {
    const bad = JSON.stringify({
      scores: {
        faithfulness: 6,
        answerRelevance: 4,
        citationAccuracy: 3,
        completeness: 4,
        contextRecall: 5,
      },
      reasoning: 'test',
    });
    expect(parseJudgeResponse(bad)).toBeNull();
  });

  it('returns null when a score is missing', () => {
    const bad = JSON.stringify({
      scores: {
        faithfulness: 5,
        answerRelevance: 4,
        citationAccuracy: 3,
        completeness: 4,
      },
      reasoning: 'test',
    });
    expect(parseJudgeResponse(bad)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseJudgeResponse('')).toBeNull();
  });
});
