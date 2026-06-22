/** Generates a short AI title for a new conversation; falls back to the truncated question on any failure. */
import { logger } from '@repo/logger';
import { anthropic } from 'app/clients/anthropic.js';

const TITLE_MODEL = 'claude-haiku-4-5-20251001';
const TITLE_MAX_TOKENS = 30;

export async function generateConversationTitle(
  question: string,
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: TITLE_MODEL,
      max_tokens: TITLE_MAX_TOKENS,
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
