'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import Captain from '@/components/Captain/Captain';
import CitationPanel from '@/components/CitationPanel/CitationPanel';
import { API_BASE } from '@/lib/api';
import Link from 'next/link';

import styles from './demo.module.scss';

interface CitedChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  filename: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: CitedChunk[];
}

interface DemoCollection {
  id: string;
  name: string;
  description: string | null;
}

const EXAMPLE_QUESTIONS: Record<string, string[]> = {
  Valve: [
    'How do employees choose what to work on at Valve?',
    'What is the hiring process like at Valve?',
    'What benefits does Valve offer?',
  ],
  GitLab: [
    'What are GitLabs core values?',
    'How does GitLab handle remote work?',
    'What is the handbook-first approach?',
  ],
  Basecamp: [
    'What is Basecamps vacation policy?',
    'How does Shape Up work at Basecamp?',
    'What are the working hours at Basecamp?',
  ],
};

function getExampleQuestions(collectionName: string): string[] {
  for (const [key, questions] of Object.entries(EXAMPLE_QUESTIONS)) {
    if (collectionName.includes(key)) return questions;
  }
  return [];
}

export default function DemoPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [activeCitation, setActiveCitation] = useState<CitedChunk | null>(null);
  const [demoCollections, setDemoCollections] = useState<DemoCollection[]>([]);
  const [selectedCollection, setSelectedCollection] =
    useState<DemoCollection | null>(null);
  const [loadError, setLoadError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch demo collections on mount
  useEffect(() => {
    fetch(`${API_BASE}/collections/demo`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Demo not available');
        return res.json();
      })
      .then((data: { collections: DemoCollection[] }) => {
        setDemoCollections(data.collections);
        if (data.collections.length > 0) {
          setSelectedCollection(data.collections[0]!);
        }
      })
      .catch(() => setLoadError('Demo collections are currently unavailable.'));
  }, []);

  const askQuestion = useCallback((question: string) => {
    setInput(question);
    // Trigger submit on next tick after input updates
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    }, 0);
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!input.trim() || streaming || !selectedCollection) return;

      const question = input.trim();
      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: question }]);
      setStreaming(true);

      let currentCitations: CitedChunk[] = [];
      let assistantContent = '';

      try {
        // Fetch CSRF token for the demo request
        const tokenRes = await fetch(`${API_BASE}/api/csrf-token`, {
          credentials: 'include',
        });
        const { token: csrfToken } = (await tokenRes.json()) as {
          token: string;
        };

        const response = await fetch(`${API_BASE}/qa`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({
            question,
            collection_id: selectedCollection.id,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error('Failed to get response');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '', citations: [] },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6);
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr) as {
                type: string;
                token?: string;
                citations?: CitedChunk[];
                message?: string;
              };

              if (event.type === 'token') {
                assistantContent += event.token;
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: assistantContent,
                      citations: currentCitations,
                    };
                  }
                  return updated;
                });
                scrollToBottom();
              } else if (event.type === 'citations') {
                currentCitations = event.citations ?? [];
              } else if (event.type === 'error') {
                assistantContent += `\n\n${event.message ?? 'An error occurred'}`;
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: assistantContent,
                    };
                  }
                  return updated;
                });
              }
            } catch {
              // skip invalid JSON
            }
          }
        }

        // Final update
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: assistantContent,
              citations: currentCitations,
            };
          }
          return updated;
        });
      } catch (err) {
        setMessages((prev) => [
          ...prev.filter((m) => m.role !== 'assistant' || m.content !== ''),
          {
            role: 'assistant',
            content: `We've hit some turbulence. ${err instanceof Error ? err.message : 'Something went wrong'}`,
          },
        ]);
      } finally {
        setStreaming(false);
        scrollToBottom();
      }
    },
    [input, streaming, selectedCollection, scrollToBottom],
  );

  const handleCitationClick = useCallback(
    (citation: CitedChunk) => {
      setActiveCitation(activeCitation?.id === citation.id ? null : citation);
    },
    [activeCitation],
  );

  const renderContent = useCallback(
    (content: string, citations?: CitedChunk[]) => {
      if (!citations || citations.length === 0) {
        return <p>{content}</p>;
      }

      const parts = content.split(/(\[\d+\])/g);
      return (
        <p>
          {parts.map((part, i) => {
            const match = part.match(/^\[(\d+)\]$/);
            if (match) {
              const idx = parseInt(match[1]!, 10) - 1;
              const chunk = citations[idx];
              if (chunk) {
                return (
                  <button
                    key={i}
                    className={styles.citationBadge}
                    aria-label={`View source ${match[1]}`}
                    onClick={() => handleCitationClick(chunk)}
                  >
                    {match[1]}
                  </button>
                );
              }
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
      );
    },
    [handleCitationClick],
  );

  return (
    <div className={styles.page}>
      {/* Signup Banner */}
      <div className={styles.banner} role='status'>
        <Captain pose='thumbsup' size='sm' alt='Captain PolicyPilot' />
        <div className={styles.bannerText}>
          <strong>This is a demo flight!</strong> Sign up to upload your own
          policies and get personalized answers.
        </div>
        <Link href='/register' className={styles.bannerCta}>
          Join the Crew
        </Link>
      </div>

      {/* Header */}
      <header className={styles.header}>
        <Link href='/' className={styles.homeLink}>
          PolicyPilot
        </Link>
        <h1 className={styles.title}>Demo</h1>
        {demoCollections.length > 1 && (
          <select
            className={styles.collectionPicker}
            value={selectedCollection?.id ?? ''}
            onChange={(e) => {
              const col = demoCollections.find((c) => c.id === e.target.value);
              if (col) {
                setSelectedCollection(col);
                setMessages([]);
              }
            }}
            aria-label='Select a demo collection'
          >
            {demoCollections.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>
        )}
        <div className={styles.headerActions}>
          <Link href='/login' className={styles.loginLink}>
            Sign In
          </Link>
          <Link href='/register' className={styles.signupLink}>
            Get Started
          </Link>
        </div>
      </header>

      {/* Chat Area */}
      <div className={styles.chatArea}>
        {loadError && (
          <div className={styles.errorState}>
            <Captain
              pose='concerned'
              size='md'
              alt='Captain PolicyPilot looks concerned'
            />
            <h2 className={styles.errorTitle}>
              We&apos;ve hit some turbulence
            </h2>
            <p className={styles.errorText}>{loadError}</p>
          </div>
        )}

        {!loadError && messages.length === 0 && (
          <div className={styles.emptyState}>
            <Captain
              pose='clipboard'
              size='md'
              alt='Captain PolicyPilot ready for questions'
            />
            <h2 className={styles.emptyTitle}>Welcome aboard, passenger!</h2>
            <p className={styles.emptyHint}>
              Ask anything about the demo handbook. Every answer comes
              flight-tested with source citations.
            </p>
            {selectedCollection && (
              <div className={styles.exampleQuestions}>
                <p className={styles.exampleLabel}>Try one of these:</p>
                {getExampleQuestions(selectedCollection.name).map((q) => (
                  <button
                    key={q}
                    className={styles.exampleButton}
                    onClick={() => askQuestion(q)}
                    disabled={streaming}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.assistant}`}
          >
            <div className={styles.bubble}>
              {renderContent(msg.content, msg.citations)}
            </div>
          </div>
        ))}

        {streaming && (
          <div className={styles.loading}>
            <Captain
              pose='thinking'
              size='sm'
              alt='Captain PolicyPilot is thinking'
            />
            <span className={styles.loadingText}>
              Scanning the flight manual...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form className={styles.inputArea} onSubmit={handleSubmit}>
        <input
          className={styles.chatInput}
          type='text'
          placeholder='Ask a question about the demo handbook...'
          aria-label='Ask a question about the demo handbook'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming || !selectedCollection}
        />
        <button
          className={styles.sendButton}
          type='submit'
          disabled={streaming || !input.trim() || !selectedCollection}
        >
          Send
        </button>
      </form>

      {/* Citation Panel */}
      <CitationPanel
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  );
}
