import Anthropic from '@anthropic-ai/sdk';
import { QA_SYSTEM_PROMPT, buildContextPrompt } from 'app/prompts/qa-system.js';
import * as convRepo from 'app/repositories/conversations/conversations.js';
import * as embeddingService from 'app/services/embedding.service.js';
import * as retrievalService from 'app/services/retrieval.service.js';
import { logger } from 'app/utils/logs/logger.js';
import type { Request, Response } from 'express';

const anthropic = new Anthropic();

export async function streamQA(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { question, conversation_id, document_ids } = req.body as {
    question?: string;
    conversation_id?: string;
    document_ids?: string[];
  };

  if (
    !question ||
    typeof question !== 'string' ||
    question.trim().length === 0
  ) {
    res.status(400).json({ error: { message: 'Question is required' } });
    return;
  }

  // Setup SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    // 1. Get or create conversation
    let conversationId = conversation_id;
    if (!conversationId) {
      const title = question.slice(0, 100);
      const conversation = await convRepo.createConversation(user.id, title);
      conversationId = conversation.id;
    }

    // 2. Save user message
    await convRepo.createMessage(conversationId, 'user', question);

    // 3. Embed the question
    const questionEmbedding =
      await embeddingService.generateEmbedding(question);

    // 4. Vector similarity search
    const chunks = await retrievalService.searchChunks(
      questionEmbedding,
      user.id,
      6,
      document_ids,
    );

    // 5. Send citations
    res.write(
      `data: ${JSON.stringify({ type: 'citations', citations: chunks })}\n\n`,
    );

    if (chunks.length === 0) {
      const noContextMsg =
        "I don't have any documents to search through. Please upload some documents first.";
      res.write(
        `data: ${JSON.stringify({ type: 'token', token: noContextMsg })}\n\n`,
      );

      const assistantMsg = await convRepo.createMessage(
        conversationId,
        'assistant',
        noContextMsg,
      );
      res.write(
        `data: ${JSON.stringify({ type: 'done', conversation_id: conversationId, message_id: assistantMsg.id })}\n\n`,
      );
      res.end();
      return;
    }

    // 6. Assemble prompt and stream response
    const contextPrompt = buildContextPrompt(chunks, question);
    let fullText = '';

    const stream = anthropic.messages.stream(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: QA_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contextPrompt }],
      },
      { signal: abortController.signal },
    );

    stream.on('text', (text) => {
      fullText += text;
      res.write(`data: ${JSON.stringify({ type: 'token', token: text })}\n\n`);
    });

    const finalMessage = await stream.finalMessage();

    // 7. Extract cited chunk IDs from the response
    const citedIndices = [...fullText.matchAll(/\[(\d+)\]/g)]
      .map((m) => parseInt(m[1]!, 10) - 1)
      .filter((i) => i >= 0 && i < chunks.length);
    const citedChunkIds = [...new Set(citedIndices)].map((i) => chunks[i]!.id);

    // 8. Persist assistant message
    const assistantMsg = await convRepo.createMessage(
      conversationId,
      'assistant',
      fullText,
      citedChunkIds,
    );

    logger.info(
      {
        event: 'qa_complete',
        userId: user.id,
        conversationId,
        chunksUsed: chunks.length,
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      },
      'Q&A response streamed',
    );

    res.write(
      `data: ${JSON.stringify({ type: 'done', conversation_id: conversationId, message_id: assistantMsg.id })}\n\n`,
    );
    res.end();
  } catch (err) {
    if (abortController.signal.aborted) {
      logger.info('Q&A stream aborted by client');
      return;
    }
    logger.error({ err }, 'Q&A streaming error');
    res.write(
      `data: ${JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : 'Internal error' })}\n\n`,
    );
    res.end();
  }
}
