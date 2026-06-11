import { describe, expect, it } from 'vitest';

import type { CitedChunkEval } from '../lib/types.js';
import {
  BASELINE_SYSTEM_PROMPT,
  batchItems,
  buildContextPrompt,
} from '../run-eval.js';

const CHUNK: CitedChunkEval = {
  id: 'c1',
  document_id: 'doc1',
  chunk_index: 0,
  content: 'Valve is a game company.',
  filename: 'valve-handbook.pdf',
};

describe('batchItems', () => {
  it('returns empty array for empty input', () => {
    expect(batchItems([], 5)).toEqual([]);
  });

  it('groups items into batches of the given size', () => {
    expect(batchItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single batch when items <= size', () => {
    expect(batchItems([1, 2], 5)).toEqual([[1, 2]]);
  });
});

describe('buildContextPrompt', () => {
  it('numbers chunks starting from 1', () => {
    const prompt = buildContextPrompt([CHUNK], 'What is Valve?');
    expect(prompt).toContain('[1]');
  });

  it('includes the filename in the context', () => {
    const prompt = buildContextPrompt([CHUNK], 'What is Valve?');
    expect(prompt).toContain('valve-handbook.pdf');
  });

  it('includes the question at the end', () => {
    const prompt = buildContextPrompt([CHUNK], 'What is Valve?');
    expect(prompt).toContain('Question: What is Valve?');
  });

  it('includes chunk content', () => {
    const prompt = buildContextPrompt([CHUNK], 'What is Valve?');
    expect(prompt).toContain('Valve is a game company.');
  });

  it('separates multiple chunks with ---', () => {
    const chunk2: CitedChunkEval = {
      ...CHUNK,
      id: 'c2',
      content: 'Valve makes Steam.',
    };
    const prompt = buildContextPrompt([CHUNK, chunk2], 'What is Valve?');
    expect(prompt).toContain('---');
    expect(prompt).toContain('[2]');
  });
});

describe('BASELINE_SYSTEM_PROMPT', () => {
  it('contains citation instruction', () => {
    expect(BASELINE_SYSTEM_PROMPT).toContain('[1], [2]');
  });

  it('instructs to use only provided context', () => {
    expect(BASELINE_SYSTEM_PROMPT).toContain('ONLY');
  });
});
