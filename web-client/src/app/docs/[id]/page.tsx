import fs from 'fs/promises';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import path from 'path';

import MarkdownViewer from '@/components/MarkdownViewer';

const DOCS: Record<string, { file: string; title: string }> = {
  summary: { file: 'SUMMARY.md', title: 'Summary' },
  'technical-overview': {
    file: 'TECHNICAL_OVERVIEW.md',
    title: 'Technical Overview',
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((id) => ({ id }));
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = DOCS[id];
  if (!doc) notFound();

  const filePath = path.join(process.cwd(), '..', 'docs', doc.file);
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    notFound();
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href='/'
          style={{
            fontSize: '0.85rem',
            color: 'var(--foreground-muted)',
            textDecoration: 'none',
          }}
        >
          &larr; Back to app
        </Link>
      </div>
      <MarkdownViewer content={content} />
    </div>
  );
}
