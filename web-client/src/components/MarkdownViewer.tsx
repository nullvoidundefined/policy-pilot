'use client';

import type { ComponentPropsWithoutRef } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';

SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);

const MermaidDiagram = dynamic(() => import('./MermaidDiagram'), { ssr: false });

function headingId(children: React.ReactNode): string {
  return String(children)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function heading(Tag: 'h1' | 'h2' | 'h3' | 'h4') {
  return function Heading({
    children,
    ...props
  }: ComponentPropsWithoutRef<typeof Tag>) {
    const id = headingId(children);
    return (
      <Tag id={id} {...props}>
        {children}
      </Tag>
    );
  };
}

export default function MarkdownViewer({ content }: { content: string }) {
  return (
    <article
      style={{ lineHeight: 1.7, fontSize: '0.95rem' }}
      className='markdown-body'
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: heading('h1'),
          h2: heading('h2'),
          h3: heading('h3'),
          h4: heading('h4'),
          code({ className, children }) {
            const language = /language-(\w+)/.exec(className ?? '')?.[1];
            if (language === 'mermaid') {
              return <MermaidDiagram chart={String(children).trim()} />;
            }
            if (language) {
              return (
                <SyntaxHighlighter
                  language={language}
                  style={oneLight}
                  PreTag='div'
                  customStyle={{
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    margin: '1rem 0',
                  }}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              );
            }
            return <code className={className}>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
