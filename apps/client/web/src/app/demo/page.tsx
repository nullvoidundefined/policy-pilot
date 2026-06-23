'use client';

/**
 * Renders the unauthenticated demo route: a streaming Q&A interface backed by
 * pre-loaded public company handbooks, allowing visitors to try RAG without signing up.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { API_BASE } from '@/api/request';
import Captain from '@/components/Captain/Captain';
import ChatAnswer from '@/components/ChatAnswer/ChatAnswer';
import CitationPanel from '@/components/CitationPanel/CitationPanel';
import { QA_STREAM_PATH } from '@/constants/apiPaths';
import { streamAnswer } from '@/services/streamAnswer';
import type { CitedChunk } from '@/types';
import Link from 'next/link';

import styles from './demo.module.scss';

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

const DEMO_COLLECTIONS_PATH = '/collections/demo';

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

function updateLastAssistant(
  messages: Message[],
  content: string,
  citations: CitedChunk[],
): Message[] {
  const updated = [...messages];
  const last = updated[updated.length - 1];
  if (last && last.role === 'assistant') {
    updated[updated.length - 1] = { ...last, content, citations };
  }
  return updated;
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
    fetch(`${API_BASE}${DEMO_COLLECTIONS_PATH}`, { credentials: 'include' })
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

  const sendQuestion = useCallback(
    async (questionText: string) => {
      if (!questionText.trim() || streaming || !selectedCollection) return;

      const question = questionText.trim();
      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: question }]);
      setStreaming(true);

      let currentCitations: CitedChunk[] = [];
      let assistantContent = '';

      try {
        await streamAnswer(
          QA_STREAM_PATH,
          { question, collection_id: selectedCollection.id },
          {
            onStart: () =>
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: '', citations: [] },
              ]),
            onToken: (token) => {
              assistantContent += token;
              setMessages((prev) =>
                updateLastAssistant(prev, assistantContent, currentCitations),
              );
              scrollToBottom();
            },
            onCitations: (citations) => {
              currentCitations = citations;
            },
            onError: (message) => {
              assistantContent += `\n\n${message ?? 'An error occurred'}`;
              setMessages((prev) =>
                updateLastAssistant(prev, assistantContent, currentCitations),
              );
            },
          },
        );

        // Final update
        setMessages((prev) =>
          updateLastAssistant(prev, assistantContent, currentCitations),
        );
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
    [streaming, selectedCollection, scrollToBottom],
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (input.trim()) sendQuestion(input);
    },
    [input, sendQuestion],
  );

  const askQuestion = useCallback(
    (question: string) => {
      sendQuestion(question);
    },
    [sendQuestion],
  );

  const handleCitationClick = useCallback(
    (citation: CitedChunk) => {
      setActiveCitation(activeCitation?.id === citation.id ? null : citation);
    },
    [activeCitation],
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
              {msg.role === 'user' ? (
                <p>{msg.content}</p>
              ) : (
                <ChatAnswer
                  content={msg.content}
                  citations={msg.citations}
                  onCitationClick={handleCitationClick}
                />
              )}
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
      <div className={styles.inputBar}>
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
      </div>

      {/* Citation Panel */}
      <CitationPanel
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  );
}
