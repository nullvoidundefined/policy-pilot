import { ApiError } from 'app/errors/ApiError.js';
import {
  getConversationMessages,
  listConversations,
} from 'app/handlers/conversations/conversations.js';
import * as convRepo from 'app/repositories/conversations/index.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/conversations/index.js', () => ({
  listConversations: vi.fn(),
  getConversation: vi.fn(),
  getMessages: vi.fn(),
}));

const mockConvRepo = vi.mocked(convRepo);

function mockReq(overrides: Record<string, unknown> = {}): any {
  return {
    user: { id: 'user-1' },
    params: {},
    ...overrides,
  };
}

function mockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('conversations handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listConversations', () => {
    it('returns the user conversations', async () => {
      const conversations = [{ id: 'conv-1' }, { id: 'conv-2' }];
      mockConvRepo.listConversations.mockResolvedValue(conversations as any);

      const req = mockReq();
      const res = mockRes();

      await listConversations(req, res);

      expect(mockConvRepo.listConversations).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ conversations });
    });
  });

  describe('getConversationMessages', () => {
    it('returns the conversation with its messages when found', async () => {
      const conversation = { id: 'conv-1', user_id: 'user-1' };
      const messages = [{ id: 'msg-1' }, { id: 'msg-2' }];
      mockConvRepo.getConversation.mockResolvedValue(conversation as any);
      mockConvRepo.getMessages.mockResolvedValue(messages as any);

      const req = mockReq({ params: { id: 'conv-1' } });
      const res = mockRes();

      await getConversationMessages(req, res);

      expect(mockConvRepo.getConversation).toHaveBeenCalledWith(
        'conv-1',
        'user-1',
      );
      expect(mockConvRepo.getMessages).toHaveBeenCalledWith('conv-1');
      expect(res.json).toHaveBeenCalledWith({ conversation, messages });
    });

    it('throws ApiError.badRequest when id is missing', async () => {
      const req = mockReq({ params: {} });
      const res = mockRes();

      await expect(getConversationMessages(req, res)).rejects.toThrow(ApiError);
      await expect(getConversationMessages(req, res)).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Conversation ID required',
      });
    });

    it('throws ApiError.notFound when conversation does not exist', async () => {
      mockConvRepo.getConversation.mockResolvedValue(null);

      const req = mockReq({ params: { id: 'conv-999' } });
      const res = mockRes();

      await expect(getConversationMessages(req, res)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Conversation not found',
      });
    });
  });
});
