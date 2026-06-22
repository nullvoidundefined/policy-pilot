import { QA_SYSTEM_PROMPT } from 'app/prompts/qaSystemPrompt.js';
import { describe, expect, it } from 'vitest';

describe('QA_SYSTEM_PROMPT', () => {
  it('instructs the model to use only provided context', () => {
    expect(QA_SYSTEM_PROMPT).toContain('ONLY');
    expect(QA_SYSTEM_PROMPT).toContain('context');
  });

  it('includes citation instructions', () => {
    expect(QA_SYSTEM_PROMPT).toContain('[1]');
    expect(QA_SYSTEM_PROMPT).toContain('Cite');
  });
});
