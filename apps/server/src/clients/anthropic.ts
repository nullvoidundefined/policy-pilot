/** Configured Anthropic SDK singleton: the single place the LLM SDK is constructed, so handlers and services never call `new Anthropic()` directly (R-222, R-224). */
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
