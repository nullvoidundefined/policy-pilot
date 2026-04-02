import type { CitedChunk } from 'policy-pilot-common';
import { describe, expect, it } from 'vitest';

import { QA_SYSTEM_PROMPT, buildContextPrompt } from './qa-system.js';

describe('qa-system prompts', () => {
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

  describe('buildContextPrompt', () => {
    it('formats chunks with numbered citations', () => {
      const chunks: CitedChunk[] = [
        {
          id: 'c1',
          document_id: 'd1',
          chunk_index: 0,
          content: 'First chunk',
          filename: 'doc1.pdf',
        },
        {
          id: 'c2',
          document_id: 'd1',
          chunk_index: 1,
          content: 'Second chunk',
          filename: 'doc1.pdf',
        },
      ];

      const result = buildContextPrompt(chunks, 'What is this about?');

      expect(result).toContain('[1]');
      expect(result).toContain('[2]');
      expect(result).toContain('First chunk');
      expect(result).toContain('Second chunk');
      expect(result).toContain('doc1.pdf');
      expect(result).toContain('What is this about?');
    });

    it('includes filename and chunk index in context', () => {
      const chunks: CitedChunk[] = [
        {
          id: 'c1',
          document_id: 'd1',
          chunk_index: 5,
          content: 'Some text',
          filename: 'report.pdf',
        },
      ];

      const result = buildContextPrompt(chunks, 'Question');
      expect(result).toContain('report.pdf');
      expect(result).toContain('chunk 5');
    });

    it('includes the question at the end', () => {
      const chunks: CitedChunk[] = [
        {
          id: 'c1',
          document_id: 'd1',
          chunk_index: 0,
          content: 'Text',
          filename: 'file.pdf',
        },
      ];

      const result = buildContextPrompt(chunks, 'My question here');
      expect(result).toContain('Question: My question here');
      // Question should appear after context
      const contextIdx = result.indexOf('Text');
      const questionIdx = result.indexOf('Question: My question here');
      expect(questionIdx).toBeGreaterThan(contextIdx);
    });
  });
});
