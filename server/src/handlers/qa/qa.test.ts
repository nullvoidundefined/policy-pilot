import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
      stream: vi.fn(),
    },
  })),
}));

vi.mock('app/repositories/conversations/conversations.js', () => ({
  createConversation: vi.fn(),
  createMessage: vi.fn(),
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

import Anthropic from '@anthropic-ai/sdk';
import * as convRepo from 'app/repositories/conversations/conversations.js';
import * as embeddingService from 'app/services/embedding.service.js';
import * as retrievalService from 'app/services/retrieval.service.js';
import { streamQA } from './qa.js';

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
  });

  describe('streamQA', () => {
    it('returns 400 when question is missing', async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();

      await streamQA(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: { message: 'Question is required' },
      });
    });

    it('returns 400 when question is empty string', async () => {
      const req = mockReq({ body: { question: '   ' } });
      const res = mockRes();

      await streamQA(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
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

      const req = mockReq({ body: { question: 'What is AI?' } });
      const res = mockRes();

      await streamQA(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
      }));

      // Should send a "no documents" message
      const written = res._written.join('');
      expect(written).toContain("don't have any documents");
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

      // Mock the Anthropic stream
      const mockStreamObj = {
        on: vi.fn().mockImplementation(function (this: any, event: string, cb: Function) {
          if (event === 'text') {
            // Immediately invoke callback with some text
            cb('Answer text [1]');
          }
          return this;
        }),
        finalMessage: vi.fn().mockResolvedValue({
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      };

      // Get the Anthropic instance and mock stream
      const anthropicInstance = new (Anthropic as any)();
      anthropicInstance.messages.stream.mockReturnValue(mockStreamObj);

      // Re-import to get fresh module with mocked Anthropic
      // Since the module-level `new Anthropic()` is already mocked, we can test directly
      const req = mockReq({ body: { question: 'What is in the doc?' } });
      const res = mockRes();

      await streamQA(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
      }));
      // Verify citations event was sent
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
        },
      });
      const res = mockRes();

      await streamQA(req, res);

      // Should NOT create a new conversation
      expect(mockConvRepo.createConversation).not.toHaveBeenCalled();
      // Should use the provided conversation_id
      expect(mockConvRepo.createMessage).toHaveBeenCalledWith(
        'existing-conv',
        'user',
        'Follow up question',
      );
    });

    it('passes document_ids to searchChunks when provided', async () => {
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
          document_ids: ['doc-1', 'doc-2'],
        },
      });
      const res = mockRes();

      await streamQA(req, res);

      expect(mockRetrieval.searchChunks).toHaveBeenCalledWith(
        expect.any(Array),
        'user-1',
        6,
        ['doc-1', 'doc-2'],
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

      // Mock Anthropic to throw a rate limit error
      const anthropicInstance = new (Anthropic as any)();
      anthropicInstance.messages.stream.mockImplementation(() => {
        throw new Error('Rate limit exceeded (429)');
      });

      const req = mockReq({ body: { question: 'test question' } });
      const res = mockRes();

      await streamQA(req, res);

      const written = res._written.join('');
      expect(written).toContain('"type":"error"');
      expect(res._ended).toBe(true);
    });
  });
});
