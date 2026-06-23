'use client';

/**
 * Renders a streamed assistant answer as formatted markdown (headings, lists,
 * bold, etc.) with inline `[N]` citation markers turned into clickable badges
 * that open the source citation. User questions render as plain text elsewhere;
 * this component is only for assistant answers.
 */
import { useMemo } from 'react';
import type { ReactNode } from 'react';

import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';

import styles from './ChatAnswer.module.scss';
import { remarkCitations } from './remarkCitations';

interface CitedChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  filename: string;
}

interface ChatAnswerProps {
  content: string;
  citations?: CitedChunk[];
  onCitationClick: (citation: CitedChunk) => void;
}

const REMARK_PLUGINS = [remarkCitations];

export default function ChatAnswer({
  content,
  citations,
  onCitationClick,
}: ChatAnswerProps) {
  const components = useMemo<Components>(
    () => ({
      cite: ({ children }) => {
        const index = parseCitationIndex(children);
        const citation = citations?.[index - 1];
        if (!citation) {
          return <>[{index}]</>;
        }
        return (
          <button
            type='button'
            className={styles.citationBadge}
            aria-label={`View source ${index}`}
            onClick={() => onCitationClick(citation)}
          >
            {index}
          </button>
        );
      },
    }),
    [citations, onCitationClick],
  );

  return (
    <div className={styles.answer}>
      <Markdown remarkPlugins={REMARK_PLUGINS} components={components}>
        {content}
      </Markdown>
    </div>
  );
}

function parseCitationIndex(children: ReactNode): number {
  return Number(String(children).replace(/\D/g, ''));
}

export type { CitedChunk };
