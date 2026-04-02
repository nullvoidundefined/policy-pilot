'use client';

import styles from './CitationPanel.module.scss';

interface Citation {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  filename: string;
}

interface CitationPanelProps {
  citation: Citation | null;
  onClose: () => void;
}

export default function CitationPanel({
  citation,
  onClose,
}: CitationPanelProps) {
  if (!citation) return null;
  return (
    <aside className={styles.panel} aria-label='Citation details'>
      <div className={styles.header}>
        <h3 className={styles.title}>Source</h3>
        <button
          onClick={onClose}
          className={styles.closeButton}
          aria-label='Close citation panel'
        >
          &times;
        </button>
      </div>
      <div className={styles.meta}>
        <span className={styles.filename}>{citation.filename}</span>
        <span className={styles.chunkIndex}>
          Section {citation.chunk_index + 1}
        </span>
      </div>
      <div className={styles.content}>{citation.content}</div>
    </aside>
  );
}
