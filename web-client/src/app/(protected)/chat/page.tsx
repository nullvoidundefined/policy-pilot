'use client';

import { useCallback, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';
import { API_BASE } from '@/lib/api';

import styles from './chat.module.scss';

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

export default function ChatPage() {
  const { logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!input.trim() || streaming) return;

      const question = input.trim();
      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: question }]);
      setStreaming(true);

      let currentCitations: CitedChunk[] = [];
      let assistantContent = '';

      try {
        const response = await fetch(`${API_BASE}/qa`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            question,
            conversation_id: conversationId,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error('Failed to get response');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Add empty assistant message
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
              const event = JSON.parse(jsonStr);

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
                currentCitations = event.citations;
              } else if (event.type === 'done') {
                setConversationId(event.conversation_id);
              } else if (event.type === 'error') {
                assistantContent += `\n\nError: ${event.message}`;
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

        // Final update with citations
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
            content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
          },
        ]);
      } finally {
        setStreaming(false);
        scrollToBottom();
      }
    },
    [input, streaming, conversationId, scrollToBottom],
  );

  const renderContent = useCallback(
    (content: string, citations?: CitedChunk[]) => {
      if (!citations || citations.length === 0) {
        return <p>{content}</p>;
      }

      // Replace [1], [2] etc with clickable badges
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
                    onClick={() =>
                      setExpandedCitation(
                        expandedCitation === chunk.id ? null : chunk.id,
                      )
                    }
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
    [expandedCitation],
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href='/documents' className={styles.backLink}>
          Documents
        </a>
        <h1 className={styles.title}>Ask a Question</h1>
        <div className={styles.headerActions}>
          <Link href='/docs/summary' className={styles.navLink}>
            Summary
          </Link>
          <Link href='/docs/technical-overview' className={styles.navLink}>
            Technical Overview
          </Link>
          <button className={styles.logoutButton} onClick={() => logout()}>
            Log Out
          </button>
        </div>
      </header>

      <div className={styles.chatArea}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <p>Ask a question about your uploaded documents.</p>
            <p className={styles.emptyHint}>
              The AI will search through your documents and provide answers with
              source citations.
            </p>
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

            {msg.citations &&
              msg.citations.map((chunk, idx) =>
                expandedCitation === chunk.id ? (
                  <div key={chunk.id} className={styles.citationExpanded}>
                    <div className={styles.citationHeader}>
                      <span className={styles.citationLabel}>
                        [{idx + 1}] {chunk.filename} (chunk {chunk.chunk_index})
                      </span>
                      <button
                        className={styles.citationClose}
                        onClick={() => setExpandedCitation(null)}
                      >
                        Close
                      </button>
                    </div>
                    <p className={styles.citationContent}>{chunk.content}</p>
                  </div>
                ) : null,
              )}
          </div>
        ))}

        {streaming && (
          <div className={styles.typing}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className={styles.inputArea} onSubmit={handleSubmit}>
        <input
          className={styles.chatInput}
          type='text'
          placeholder='Ask a question about your documents...'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
        />
        <button
          className={styles.sendButton}
          type='submit'
          disabled={streaming || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
