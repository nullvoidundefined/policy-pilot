'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import Captain from '@/components/Captain/Captain';
import CitationPanel from '@/components/CitationPanel/CitationPanel';
import { useAuth } from '@/context/AuthContext';
import { API_BASE, ensureCsrfToken, get } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';

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

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
}

interface CollectionInfo {
  id: string;
  name: string;
}

export default function CollectionChatPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { logout } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<CitedChunk | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [collection, setCollection] = useState<CollectionInfo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch collection info
  useEffect(() => {
    get<{ collection: CollectionInfo }>(`/collections/${collectionId}`)
      .then((res) => setCollection(res.collection))
      .catch(() => {});
  }, [collectionId]);

  // Fetch conversation history
  useEffect(() => {
    get<{ conversations: Conversation[] }>(
      `/collections/${collectionId}/conversations`,
    )
      .then((res) => setConversations(res.conversations ?? []))
      .catch(() => {});
  }, [collectionId]);

  const loadConversation = useCallback(async (convId: string) => {
    try {
      const res = await get<{ messages: Message[] }>(
        `/conversations/${convId}/messages`,
      );
      setMessages(res.messages ?? []);
      setConversationId(convId);
    } catch {
      // silent fail
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setActiveCitation(null);
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
        const csrfToken = await ensureCsrfToken();

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
            collection_id: collectionId,
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
            content: `We've hit some turbulence. ${err instanceof Error ? err.message : 'Something went wrong'}`,
          },
        ]);
      } finally {
        setStreaming(false);
        scrollToBottom();
      }
    },
    [input, streaming, conversationId, collectionId, scrollToBottom],
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
      {/* Conversation Sidebar */}
      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}
        aria-label='Conversation history'
      >
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>Conversations</h2>
          <button
            className={styles.newChatButton}
            onClick={startNewConversation}
            aria-label='Start new conversation'
          >
            + New
          </button>
        </div>
        <nav className={styles.conversationList}>
          {conversations.length === 0 ? (
            <p className={styles.noConversations}>No conversations yet</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                className={`${styles.conversationItem} ${conversationId === conv.id ? styles.conversationActive : ''}`}
                onClick={() => loadConversation(conv.id)}
              >
                <span className={styles.conversationTitle}>
                  {conv.title ?? 'Untitled'}
                </span>
                <span className={styles.conversationDate}>
                  {new Date(conv.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </button>
            ))
          )}
        </nav>
      </aside>

      {/* Main Chat Area */}
      <div className={styles.main}>
        <header className={styles.header}>
          <button
            className={styles.sidebarToggle}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? '\u2190' : '\u2192'}
          </button>
          <Link
            href={`/collections/${collectionId}`}
            className={styles.backLink}
          >
            {collection?.name ?? 'Back to Collection'}
          </Link>
          <h1 className={styles.title}>Ask Your Policy</h1>
          <div className={styles.headerActions}>
            <button className={styles.logoutButton} onClick={() => logout()}>
              Log Out
            </button>
          </div>
        </header>

        <div className={styles.chatArea}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <Captain
                pose='clipboard'
                size='md'
                alt='Captain PolicyPilot ready for questions'
              />
              <h2 className={styles.emptyTitle}>
                Ready for your questions, co-pilot!
              </h2>
              <p className={styles.emptyHint}>
                Ask anything about your uploaded documents. Every answer comes
                with source citations you can verify.
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

        <form className={styles.inputArea} onSubmit={handleSubmit}>
          <input
            className={styles.chatInput}
            type='text'
            placeholder='Ask a question about your policies...'
            aria-label='Ask a question about your policies'
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

      {/* Citation Panel */}
      <CitationPanel
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  );
}
