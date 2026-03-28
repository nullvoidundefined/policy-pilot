'use client';

import mermaid from 'mermaid';
import { useEffect, useId, useRef, useState } from 'react';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  themeVariables: {
    background: '#ffffff',
    primaryColor: '#eff6ff',
    primaryTextColor: '#222222',
    primaryBorderColor: '#3b82f6',
    lineColor: '#717171',
    secondaryColor: '#f0fdf4',
    tertiaryColor: '#f7f7f7',
    edgeLabelBackground: '#ffffff',
    clusterBkg: '#f7f7f7',
    titleColor: '#222222',
    nodeTextColor: '#222222',
  },
});

export default function MermaidDiagram({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    mermaid
      .render(`mermaid-${id}`, chart)
      .then(({ svg: rendered }) => setSvg(rendered))
      .catch((err) => setError(String(err)));
  }, [chart, id]);

  if (error) {
    return (
      <pre style={{ color: '#ef4444', fontSize: '0.8rem', padding: '1rem' }}>
        {error}
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      style={{ overflowX: 'auto', margin: '1.5rem 0' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
