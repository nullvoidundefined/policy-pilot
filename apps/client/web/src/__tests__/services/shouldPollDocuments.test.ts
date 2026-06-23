import { shouldPollDocuments } from '@/services/shouldPollDocuments';
import { describe, expect, it } from 'vitest';

describe('shouldPollDocuments', () => {
  it('returns true while a freshly uploaded document is still processing', () => {
    expect(shouldPollDocuments([{ status: 'uploaded' }])).toBe(true);
  });

  it('returns true for in-flight chunking or embedding documents', () => {
    expect(shouldPollDocuments([{ status: 'chunking' }])).toBe(true);
    expect(shouldPollDocuments([{ status: 'embedding' }])).toBe(true);
  });

  it('returns false once every document has reached a terminal status', () => {
    expect(
      shouldPollDocuments([
        { status: 'ready' },
        { status: 'failed' },
        { status: 'rejected' },
      ]),
    ).toBe(false);
  });

  it('returns false for an empty document list', () => {
    expect(shouldPollDocuments([])).toBe(false);
  });
});
