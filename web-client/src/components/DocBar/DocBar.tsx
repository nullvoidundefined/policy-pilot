'use client';

import '@bottomlessmargaritas/doc-bar/styles.css';

import AppDocBar from '@bottomlessmargaritas/doc-bar';

export default function DocBar() {
  return (
    <AppDocBar
      appName='Document Q&A RAG'
      position='bottom'
      fixed={false}
      theme='dark'
    />
  );
}
