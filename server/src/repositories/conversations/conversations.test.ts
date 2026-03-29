import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();

vi.mock('app/db/pool/pool.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  default: { query: vi.fn(), end: vi.fn(), on: vi.fn() },
}));

vi.mock('app/utils/logs/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  createConversation,
  getConversation,
  listConversations,
  createMessage,
  getMessages,
} from './conversations.js';

describe('conversations repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createConversation', () => {
    it('inserts and returns a conversation', async () => {
      const mockConv = { id: 'conv-1', user_id: 'user-1', title: 'Test Q' };
      mockQuery.mockResolvedValue({ rows: [mockConv] });

      const result = await createConversation('user-1', 'Test Q');
      expect(result).toEqual(mockConv);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO conversations'),
        ['user-1', 'Test Q'],
      );
    });

    it('throws when insert returns no row', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await expect(createConversation('user-1', 'Test')).rejects.toThrow(
        'Insert returned no row',
      );
    });
  });

  describe('getConversation', () => {
    it('returns conversation scoped to user', async () => {
      const mockConv = { id: 'conv-1', user_id: 'user-1', title: 'Test' };
      mockQuery.mockResolvedValue({ rows: [mockConv] });

      const result = await getConversation('conv-1', 'user-1');
      expect(result).toEqual(mockConv);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND user_id = $2'),
        ['conv-1', 'user-1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getConversation('conv-999', 'user-1');
      expect(result).toBeNull();
    });
  });

  describe('listConversations', () => {
    it('returns conversations ordered by updated_at DESC', async () => {
      const convs = [
        { id: 'conv-2', title: 'Newer' },
        { id: 'conv-1', title: 'Older' },
      ];
      mockQuery.mockResolvedValue({ rows: convs });

      const result = await listConversations('user-1');
      expect(result).toEqual(convs);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY updated_at DESC'),
        ['user-1'],
      );
    });
  });

  describe('createMessage', () => {
    it('creates a user message', async () => {
      const mockMsg = {
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'What is AI?',
        cited_chunk_ids: [],
      };
      mockQuery.mockResolvedValue({ rows: [mockMsg] });

      const result = await createMessage('conv-1', 'user', 'What is AI?');
      expect(result).toEqual(mockMsg);
    });

    it('creates an assistant message with cited chunk IDs', async () => {
      const mockMsg = {
        id: 'msg-2',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'AI is...',
        cited_chunk_ids: ['chunk-1', 'chunk-2'],
      };
      mockQuery.mockResolvedValue({ rows: [mockMsg] });

      const result = await createMessage('conv-1', 'assistant', 'AI is...', [
        'chunk-1',
        'chunk-2',
      ]);
      expect(result).toEqual(mockMsg);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('cited_chunk_ids'),
        ['conv-1', 'assistant', 'AI is...', ['chunk-1', 'chunk-2']],
      );
    });
  });

  describe('getMessages', () => {
    it('returns messages ordered by created_at ASC', async () => {
      const msgs = [
        { id: 'msg-1', role: 'user', content: 'Hi' },
        { id: 'msg-2', role: 'assistant', content: 'Hello' },
      ];
      mockQuery.mockResolvedValue({ rows: msgs });

      const result = await getMessages('conv-1');
      expect(result).toEqual(msgs);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at ASC'),
        ['conv-1'],
      );
    });
  });
});
