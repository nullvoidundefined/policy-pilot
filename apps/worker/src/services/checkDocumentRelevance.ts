/** Classifies whether a document is policy-related via a cheap Anthropic call; on any parse or API failure it fails open (treats the document as relevant) so processing continues. */
import type { logger } from '@repo/logger';
import { anthropic } from 'app/clients/anthropic.js';

export interface DocumentRelevance {
  isRelevant: boolean;
  reason: string;
  score: number;
}

const RELEVANCE_MODEL = 'claude-haiku-4-5-20251001';
const RELEVANCE_MAX_TOKENS = 100;
const RELEVANCE_THRESHOLD = 0.5;
const PREVIEW_LENGTH = 2000;
const RELEVANT_BY_DEFAULT: DocumentRelevance = {
  isRelevant: true,
  reason: '',
  score: 1,
};

export async function checkDocumentRelevance(
  text: string,
  log: typeof logger,
): Promise<DocumentRelevance> {
  const preview = text.slice(0, PREVIEW_LENGTH);
  try {
    const response = await anthropic.messages.create({
      model: RELEVANCE_MODEL,
      max_tokens: RELEVANCE_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: `Classify this document. Is it an employee policy document, company handbook, HR document, compliance manual, or standard operating procedure? Respond with JSON only: {"score": 0.0-1.0, "reason": "brief explanation"}\n\nDocument preview:\n${preview}`,
        },
      ],
    });

    const block = response.content[0];
    const relevanceText = block?.type === 'text' ? block.text : '';

    let score = 1;
    let reason = '';
    try {
      const parsed = JSON.parse(relevanceText);
      score = typeof parsed.score === 'number' ? parsed.score : 1;
      reason = typeof parsed.reason === 'string' ? parsed.reason : '';
    } catch {
      log.warn('Could not parse relevance response, proceeding anyway');
      return RELEVANT_BY_DEFAULT;
    }

    return { isRelevant: score >= RELEVANCE_THRESHOLD, reason, score };
  } catch (err) {
    log.warn({ err }, 'Relevance check failed, proceeding with processing');
    return RELEVANT_BY_DEFAULT;
  }
}
