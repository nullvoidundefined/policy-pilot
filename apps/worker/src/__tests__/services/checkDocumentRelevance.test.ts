import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('app/clients/anthropic.js', () => ({
  anthropic: { messages: { create: mockCreate } },
}));

const { checkDocumentRelevance } =
  await import('app/services/checkDocumentRelevance.js');

const log = {
  info: vi.fn(),
  warn: vi.fn(),
} as unknown as Parameters<typeof checkDocumentRelevance>[1];

function textResponse(body: string) {
  return { content: [{ type: 'text', text: body }] };
}

describe('checkDocumentRelevance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks a high-scoring document relevant', async () => {
    mockCreate.mockResolvedValue(
      textResponse('{"score": 0.9, "reason": "HR policy"}'),
    );
    const result = await checkDocumentRelevance('some policy text', log);
    expect(result.isRelevant).toBe(true);
    expect(result.score).toBe(0.9);
    expect(result.reason).toBe('HR policy');
  });

  it('marks a low-scoring document not relevant', async () => {
    mockCreate.mockResolvedValue(
      textResponse('{"score": 0.2, "reason": "not a policy"}'),
    );
    const result = await checkDocumentRelevance('random text', log);
    expect(result.isRelevant).toBe(false);
    expect(result.reason).toBe('not a policy');
  });

  it('proceeds (relevant) when the response is unparseable', async () => {
    mockCreate.mockResolvedValue(textResponse('not json'));
    const result = await checkDocumentRelevance('text', log);
    expect(result.isRelevant).toBe(true);
    expect(result.score).toBe(1);
  });

  it('proceeds (relevant) when the Anthropic call throws', async () => {
    mockCreate.mockRejectedValue(new Error('api down'));
    const result = await checkDocumentRelevance('text', log);
    expect(result.isRelevant).toBe(true);
  });
});
