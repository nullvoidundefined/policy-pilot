import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateConversationTitle } from './generateConversationTitle.js';

const { mockMessagesCreate } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Default Title' }],
  }),
}));

vi.mock('app/clients/anthropic.js', () => ({
  anthropic: { messages: { create: mockMessagesCreate } },
}));

vi.mock('@repo/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('generateConversationTitle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls Anthropic with haiku model and returns generated title', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'Understanding Machine Learning Basics' },
      ],
    });

    const title = await generateConversationTitle('What is machine learning?');

    expect(title).toBe('Understanding Machine Learning Basics');
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 30,
      }),
    );
  });

  it('falls back to truncated question when API call fails', async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error('API rate limit'));

    const title = await generateConversationTitle(
      'What is the meaning of life?',
    );

    expect(title).toBe('What is the meaning of life?');
  });

  it('falls back to truncated question when response has no text', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '' }],
    });

    const longQuestion = 'A'.repeat(150);
    const title = await generateConversationTitle(longQuestion);

    expect(title).toBe(longQuestion.slice(0, 100));
  });
});
