import Anthropic from '@anthropic-ai/sdk';
import { QA_SYSTEM_PROMPT, buildContextPrompt } from 'app/prompts/qa-system.js';
import * as convRepo from 'app/repositories/conversations/conversations.js';
import * as embeddingService from 'app/services/embedding.service.js';
import * as retrievalService from 'app/services/retrieval.service.js';
import { ApiError } from 'app/utils/ApiError.js';
import { logger } from 'app/utils/logs/logger.js';
import type { Request, Response } from 'express';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateConversationTitle(
  question: string,
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 30,
      messages: [
        {
          role: 'user',
          content: `Generate a 3-6 word title for a conversation that started with this question: ${question}. Reply with just the title, no quotes.`,
        },
      ],
    });
    const block = response.content[0];
    if (block?.type === 'text' && block.text.trim().length > 0) {
      return block.text.trim();
    }
    return question.slice(0, 100);
  } catch (err) {
    logger.warn({ err }, 'Title generation failed, using fallback');
    return question.slice(0, 100);
  }
}

export async function streamQA(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { question, conversation_id, collection_id } = req.body as {
    question?: string;
    conversation_id?: string;
    collection_id?: string;
  };

  // Pre-stream validation — throw ApiError (handled by global error handler)
  if (
    !question ||
    typeof question !== 'string' ||
    question.trim().length === 0
  ) {
    throw ApiError.badRequest('Question is required');
  }

  if (!collection_id) {
    throw ApiError.badRequest('collection_id is required');
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
    let isNewConversation = false;
    if (!conversationId && user) {
      const title = question.slice(0, 100);
      const conversation = await convRepo.createConversation(user.id, title);
      conversationId = conversation.id;
      isNewConversation = true;
    }

    // 2. Save user message
    if (conversationId) {
      await convRepo.createMessage(conversationId, 'user', question);
    }

    // 2b. Generate AI title for new conversations (fire-and-forget)
    if (isNewConversation && conversationId) {
      const convId = conversationId;
      generateConversationTitle(question)
        .then((title) => convRepo.updateConversationTitle(convId, title))
        .catch((err) => logger.warn({ err }, 'Async title update failed'));
    }

    // 3. Embed the question
    const questionEmbedding =
      await embeddingService.generateEmbedding(question);

    // 4. Vector similarity search
    const chunks = await retrievalService.searchChunks(
      questionEmbedding,
      user?.id ?? null,
      6,
      collection_id,
    );

    // 5. Send citations
    res.write(
      `data: ${JSON.stringify({ type: 'citations', citations: chunks })}\n\n`,
    );

    if (chunks.length === 0) {
      const noContextMsg =
        "I couldn't find any relevant information for your question in the available documents. Try rephrasing your question or uploading additional policy documents.";
      res.write(
        `data: ${JSON.stringify({ type: 'token', token: noContextMsg })}\n\n`,
      );

      let messageId: string | undefined;
      if (conversationId) {
        const assistantMsg = await convRepo.createMessage(
          conversationId,
          'assistant',
          noContextMsg,
        );
        messageId = assistantMsg.id;
      }
      res.write(
        `data: ${JSON.stringify({ type: 'done', conversation_id: conversationId ?? null, message_id: messageId ?? null })}\n\n`,
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
    let messageId: string | undefined;
    if (conversationId) {
      const assistantMsg = await convRepo.createMessage(
        conversationId,
        'assistant',
        fullText,
        citedChunkIds,
      );
      messageId = assistantMsg.id;
    }

    logger.info(
      {
        event: 'qa_complete',
        userId: user?.id ?? null,
        conversationId: conversationId ?? null,
        chunksUsed: chunks.length,
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      },
      'Q&A response streamed',
    );

    res.write(
      `data: ${JSON.stringify({ type: 'done', conversation_id: conversationId ?? null, message_id: messageId ?? null })}\n\n`,
    );
    res.end();
  } catch (err) {
    // Inline error handling for stream errors (headers already sent)
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
