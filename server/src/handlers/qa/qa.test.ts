import * as collectionsRepo from 'app/repositories/collections/collections.js';
import * as convRepo from 'app/repositories/conversations/conversations.js';
import * as embeddingService from 'app/services/embedding.service.js';
import * as retrievalService from 'app/services/retrieval.service.js';
import { ApiError } from 'app/utils/ApiError.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateConversationTitle, streamQA } from './qa.js';

const { mockMessagesCreate, mockMessagesStream } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Default Title' }],
  }),
  mockMessagesStream: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockMessagesCreate,
      stream: mockMessagesStream,
    },
  })),
}));

vi.mock('app/repositories/conversations/conversations.js', () => ({
  createConversation: vi.fn(),
  createMessage: vi.fn(),
  updateConversationTitle: vi.fn(),
}));

vi.mock('app/repositories/collections/collections.js', () => ({
  getCollectionById: vi.fn(),
}));

vi.mock('app/services/embedding.service.js', () => ({
  generateEmbedding: vi.fn(),
}));

vi.mock('app/services/retrieval.service.js', () => ({
  searchChunks: vi.fn(),
}));

vi.mock('app/utils/logs/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

const mockCollections = vi.mocked(collectionsRepo);
const mockConvRepo = vi.mocked(convRepo);
const mockEmbedding = vi.mocked(embeddingService);
const mockRetrieval = vi.mocked(retrievalService);

function mockReq(overrides: Record<string, unknown> = {}): any {
  return {
    user: { id: 'user-1' },
    body: {},
    on: vi.fn(),
    ...overrides,
  };
}

function mockRes(): any {
  const res: any = {
    _written: [] as string[],
    _ended: false,
    headersSent: false,
  };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.writeHead = vi.fn().mockReturnValue(res);
  res.write = vi.fn((data: string) => {
    res._written.push(data);
    return true;
  });
  res.end = vi.fn(() => {
    res._ended = true;
  });
  return res;
}

describe('qa handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: non-demo collection (user_id filter applied)
    mockCollections.getCollectionById.mockResolvedValue({
      id: 'col-1',
      user_id: 'user-1',
      name: 'Test Collection',
      description: null,
      is_demo: false,
      created_at: new Date().toISOString(),
    });
  });

  describe('streamQA', () => {
    it('throws ApiError.badRequest when question is missing', async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();

      await expect(streamQA(req, res)).rejects.toThrow(ApiError);
      await expect(streamQA(req, res)).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Question is required',
      });
    });

    it('throws ApiError.badRequest when question is empty string', async () => {
      const req = mockReq({
        body: { question: '   ', collection_id: 'col-1' },
      });
      const res = mockRes();

      await expect(streamQA(req, res)).rejects.toThrow(ApiError);
      await expect(streamQA(req, res)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('throws ApiError.badRequest when collection_id is missing', async () => {
      const req = mockReq({ body: { question: 'What is AI?' } });
      const res = mockRes();

      await expect(streamQA(req, res)).rejects.toThrow(ApiError);
      await expect(streamQA(req, res)).rejects.toMatchObject({
        statusCode: 400,
        message: 'collection_id is required',
      });
    });

    it('handles no relevant chunks found', async () => {
      mockConvRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        user_id: 'user-1',
        title: 'Test',
        created_at: '',
        updated_at: '',
      });
      mockConvRepo.createMessage.mockResolvedValue({
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'test',
        cited_chunk_ids: [],
        created_at: '',
      });
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2]);
      mockRetrieval.searchChunks.mockResolvedValue([]);

      const req = mockReq({
        body: { question: 'What is AI?', collection_id: 'col-1' },
      });
      const res = mockRes();

      await streamQA(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          'Content-Type': 'text/event-stream',
        }),
      );

      const written = res._written.join('');
      expect(written).toContain("couldn't find any relevant information");
      expect(written).toContain('"type":"done"');
      expect(res._ended).toBe(true);
    });

    it('streams response with citations when chunks found', async () => {
      mockConvRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        user_id: 'user-1',
        title: 'Test',
        created_at: '',
        updated_at: '',
      });
      mockConvRepo.createMessage.mockResolvedValue({
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'Answer text [1]',
        cited_chunk_ids: ['chunk-1'],
        created_at: '',
      });
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2]);
      mockRetrieval.searchChunks.mockResolvedValue([
        {
          id: 'chunk-1',
          document_id: 'doc-1',
          chunk_index: 0,
          content: 'Context text',
          filename: 'test.pdf',
        },
      ]);

      const mockStreamObj = {
        on: vi.fn().mockImplementation(function (
          this: any,
          event: string,
          cb: (text: string) => void,
        ) {
          if (event === 'text') {
            cb('Answer text [1]');
          }
          return this;
        }),
        finalMessage: vi.fn().mockResolvedValue({
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      };

      mockMessagesStream.mockReturnValue(mockStreamObj);
      const req = mockReq({
        body: { question: 'What is in the doc?', collection_id: 'col-1' },
      });
      const res = mockRes();

      await streamQA(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          'Content-Type': 'text/event-stream',
        }),
      );
      const written = res._written.join('');
      expect(written).toContain('"type":"citations"');
    });

    it('uses existing conversation_id when provided', async () => {
      mockConvRepo.createMessage.mockResolvedValue({
        id: 'msg-1',
        conversation_id: 'existing-conv',
        role: 'user',
        content: 'test',
        cited_chunk_ids: [],
        created_at: '',
      });
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1]);
      mockRetrieval.searchChunks.mockResolvedValue([]);

      const req = mockReq({
        body: {
          question: 'Follow up question',
          conversation_id: 'existing-conv',
          collection_id: 'col-1',
        },
      });
      const res = mockRes();

      await streamQA(req, res);

      expect(mockConvRepo.createConversation).not.toHaveBeenCalled();
      expect(mockConvRepo.createMessage).toHaveBeenCalledWith(
        'existing-conv',
        'user',
        'Follow up question',
      );
    });

    it('passes collection_id to searchChunks when provided', async () => {
      mockConvRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        user_id: 'user-1',
        title: 'Test',
        created_at: '',
        updated_at: '',
      });
      mockConvRepo.createMessage.mockResolvedValue({
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'test',
        cited_chunk_ids: [],
        created_at: '',
      });
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1]);
      mockRetrieval.searchChunks.mockResolvedValue([]);

      const req = mockReq({
        body: {
          question: 'Scoped question',
          collection_id: 'col-1',
        },
      });
      const res = mockRes();

      await streamQA(req, res);

      expect(mockRetrieval.searchChunks).toHaveBeenCalledWith(
        expect.any(Array),
        'user-1',
        6,
        'col-1',
      );
    });

    it('handles Anthropic API errors gracefully', async () => {
      mockConvRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        user_id: 'user-1',
        title: 'Test',
        created_at: '',
        updated_at: '',
      });
      mockConvRepo.createMessage.mockResolvedValue({
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'test',
        cited_chunk_ids: [],
        created_at: '',
      });
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1]);
      mockRetrieval.searchChunks.mockResolvedValue([
        {
          id: 'chunk-1',
          document_id: 'doc-1',
          chunk_index: 0,
          content: 'text',
          filename: 'test.pdf',
        },
      ]);

      mockMessagesStream.mockImplementation(() => {
        throw new Error('Rate limit exceeded (429)');
      });

      const req = mockReq({
        body: { question: 'test question', collection_id: 'col-1' },
      });
      const res = mockRes();

      await streamQA(req, res);

      const written = res._written.join('');
      expect(written).toContain('"type":"error"');
      expect(res._ended).toBe(true);
    });
  });

  describe('generateConversationTitle', () => {
    it('calls Anthropic with haiku model and returns generated title', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'Understanding Machine Learning Basics' },
        ],
      });

      const title = await generateConversationTitle(
        'What is machine learning?',
      );

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

  describe('title generation in streamQA', () => {
    it('generates title only for new conversations (no conversation_id)', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Generated Title' }],
      });

      mockConvRepo.createConversation.mockResolvedValue({
        id: 'conv-1',
        user_id: 'user-1',
        title: 'Test',
        created_at: '',
        updated_at: '',
      });
      mockConvRepo.createMessage.mockResolvedValue({
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'test',
        cited_chunk_ids: [],
        created_at: '',
      });
      mockConvRepo.updateConversationTitle.mockResolvedValue(undefined);
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1]);
      mockRetrieval.searchChunks.mockResolvedValue([]);

      const req = mockReq({
        body: { question: 'What is AI?', collection_id: 'col-1' },
      });
      const res = mockRes();

      await streamQA(req, res);

      // Wait for fire-and-forget promise to resolve
      await new Promise((r) => setTimeout(r, 50));

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5-20251001',
        }),
      );
      expect(mockConvRepo.updateConversationTitle).toHaveBeenCalledWith(
        'conv-1',
        'Generated Title',
      );
    });

    it('does not generate title for existing conversations', async () => {
      mockConvRepo.createMessage.mockResolvedValue({
        id: 'msg-1',
        conversation_id: 'existing-conv',
        role: 'user',
        content: 'test',
        cited_chunk_ids: [],
        created_at: '',
      });
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1]);
      mockRetrieval.searchChunks.mockResolvedValue([]);

      const req = mockReq({
        body: {
          question: 'Follow up question',
          conversation_id: 'existing-conv',
          collection_id: 'col-1',
        },
      });
      const res = mockRes();

      await streamQA(req, res);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockConvRepo.updateConversationTitle).not.toHaveBeenCalled();
    });
  });
});
