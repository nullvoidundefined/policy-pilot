import { describe, expect, it } from 'vitest';

import { chunkText } from '../index.js';

// Byte-identical guard for the A6.4a decomposition: these inline snapshots are
// captured from the pre-split monolith and pin the exact chunk output (content,
// index, tokenCount) across every code path - the merge/overlap loop, both
// former hard-split fallback sites, custom separators, and the empty cases.
// @repo/chunker is reused by apps 5 and 7, so any drift here is a real bug.
describe('chunkText golden output', () => {
  it('pins a single small chunk (default options)', () => {
    expect(chunkText('Hello world')).toMatchInlineSnapshot(`
      [
        {
          "content": "Hello world",
          "index": 0,
          "tokenCount": 3,
        },
      ]
    `);
  });

  it('pins multi-paragraph output with overlap', () => {
    const text = Array.from(
      { length: 12 },
      (_, i) => `Paragraph ${i}. ` + 'x '.repeat(40),
    ).join('\n\n');
    expect(chunkText(text, { maxTokens: 60, overlapTokens: 15 }))
      .toMatchInlineSnapshot(`
      [
        {
          "content": "Paragraph 0. x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x 

      Paragraph 1. x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x",
          "index": 0,
          "tokenCount": 47,
        },
        {
          "content": "x x x x x x x x x x x x x x x x x x x x x x x x x x x x x 

      Paragraph 2. x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x",
          "index": 1,
          "tokenCount": 38,
        },
        {
          "content": "x x x x x x x x x x x x x x x x x x x x x x x x x x x x x 

      Paragraph 3. x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x",
          "index": 2,
          "tokenCount": 38,
        },
        {
          "content": "x x x x x x x x x x x x x x x x x x x x x x x x x x x x x 

      Paragraph 4. x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x",
          "index": 3,
          "tokenCount": 38,
        },
        {
          "content": "x x x x x x x x x x x x x x x x x x x x x x x x x x x x x 

      Paragraph 5. x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x",
          "index": 4,
          "tokenCount": 38,
        },
        {
          "content": "x x x x x x x x x x x x x x x x x x x x x x x x x x x x x 

      Paragraph 6. x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x",
          "index": 5,
          "tokenCount": 38,
        },
        {
          "content": "x x x x x x x x x x x x x x x x x x x x x x x x x x x x x 

      Paragraph 7. x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x",
          "index": 6,
          "tokenCount": 38,
        },
        {
          "content": "x x x x x x x x x x x x x x x x x x x x x x x x x x x x x 

      Paragraph 8. x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x",
          "index": 7,
          "tokenCount": 38,
        },
        {
          "content": "x x x x x x x x x x x x x x x x x x x x x x x x x x x x x 

      Paragraph 9. x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x",
          "index": 8,
          "tokenCount": 38,
        },
        {
          "content": "x x x x x x x x x x x x x x x x x x x x x x x x x x x x x 

      Paragraph 10. x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x",
          "index": 9,
          "tokenCount": 39,
        },
        {
          "content": "x x x x x x x x x x x x x x x x x x x x x x x x x x x x x 

      Paragraph 11. x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x",
          "index": 10,
          "tokenCount": 39,
        },
      ]
    `);
  });

  it('pins custom-separator output', () => {
    const text =
      'aaaa bbbb cccc dddd|||eeee ffff gggg hhhh|||iiii jjjj kkkk llll';
    expect(
      chunkText(text, { maxTokens: 5, separators: ['|||'], overlapTokens: 0 }),
    ).toMatchInlineSnapshot(`
      [
        {
          "content": "aaaa bbbb cccc dddd|",
          "index": 0,
          "tokenCount": 5,
        },
        {
          "content": "aaaa bbbb cccc dddd|||",
          "index": 1,
          "tokenCount": 6,
        },
        {
          "content": "aaaa bbbb cccc dddd|||eeee ffff gggg hhhh|",
          "index": 2,
          "tokenCount": 11,
        },
        {
          "content": "aaaa bbbb cccc dddd|||eeee ffff gggg hhhh|||",
          "index": 3,
          "tokenCount": 11,
        },
        {
          "content": "aaaa bbbb cccc dddd|||eeee ffff gggg hhhh|||iiii jjjj kkkk llll",
          "index": 4,
          "tokenCount": 16,
        },
      ]
    `);
  });

  it('pins no-separator hard-split output (final fallback site)', () => {
    expect(chunkText('a'.repeat(900), { maxTokens: 30 }))
      .toMatchInlineSnapshot(`
      [
        {
          "content": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "index": 0,
          "tokenCount": 30,
        },
        {
          "content": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "index": 1,
          "tokenCount": 60,
        },
        {
          "content": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "index": 2,
          "tokenCount": 80,
        },
        {
          "content": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "index": 3,
          "tokenCount": 80,
        },
        {
          "content": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "index": 4,
          "tokenCount": 80,
        },
        {
          "content": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "index": 5,
          "tokenCount": 80,
        },
        {
          "content": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "index": 6,
          "tokenCount": 80,
        },
        {
          "content": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "index": 7,
          "tokenCount": 65,
        },
      ]
    `);
  });

  it('pins oversized-segment hard-split output (in-loop fallback site)', () => {
    const text = 'short ' + 'b'.repeat(600) + ' end';
    expect(chunkText(text, { maxTokens: 20 })).toMatchInlineSnapshot(`
      [
        {
          "content": "short",
          "index": 0,
          "tokenCount": 2,
        },
        {
          "content": "short bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "index": 1,
          "tokenCount": 22,
        },
        {
          "content": "short bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "index": 2,
          "tokenCount": 42,
        },
        {
          "content": "short bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "index": 3,
          "tokenCount": 62,
        },
        {
          "content": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "index": 4,
          "tokenCount": 70,
        },
        {
          "content": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "index": 5,
          "tokenCount": 70,
        },
        {
          "content": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "index": 6,
          "tokenCount": 70,
        },
        {
          "content": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "index": 7,
          "tokenCount": 70,
        },
        {
          "content": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "index": 8,
          "tokenCount": 60,
        },
        {
          "content": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb end",
          "index": 9,
          "tokenCount": 51,
        },
      ]
    `);
  });

  it('pins empty and whitespace-only inputs', () => {
    expect(chunkText('')).toMatchInlineSnapshot(`[]`);
    expect(chunkText('   \n\n  \n  ')).toMatchInlineSnapshot(`[]`);
  });
});
