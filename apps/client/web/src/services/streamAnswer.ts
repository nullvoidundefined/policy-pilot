/**
 * Shared SSE answer-streaming service for the RAG Q&A surfaces: POSTs a question
 * through streamPost, decodes the server-sent event stream, and dispatches parsed
 * token/citation/done/error events to caller callbacks so the demo and chat pages
 * own only their component state (R-227/R-234).
 */
import { streamPost } from '@/api/request';
import { SSE_DATA_PREFIX } from '@/constants/sse';
import type { CitedChunk } from '@/types';

export interface StreamAnswerEvent {
  citations?: CitedChunk[];
  conversation_id?: string;
  message?: string;
  token?: string;
  type: string;
}

export interface StreamAnswerCallbacks {
  onCitations: (citations: CitedChunk[]) => void;
  onDone?: (event: StreamAnswerEvent) => void;
  onError?: (message: string | undefined) => void;
  onStart?: () => void;
  onToken: (token: string) => void;
}

export async function streamAnswer(
  path: string,
  body: unknown,
  callbacks: StreamAnswerCallbacks,
): Promise<void> {
  const stream = await streamPost(path, body);
  callbacks.onStart?.();
  await parseSseStream(stream, callbacks);
}

async function parseSseStream(
  stream: ReadableStream<Uint8Array>,
  callbacks: StreamAnswerCallbacks,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      dispatchSseLine(line, callbacks);
    }
  }
}

function dispatchSseLine(line: string, callbacks: StreamAnswerCallbacks): void {
  if (!line.startsWith(SSE_DATA_PREFIX)) return;
  const jsonStr = line.slice(SSE_DATA_PREFIX.length);
  if (!jsonStr) return;

  let event: StreamAnswerEvent;
  try {
    event = JSON.parse(jsonStr) as StreamAnswerEvent;
  } catch {
    return; // skip invalid JSON
  }

  if (event.type === 'token') {
    callbacks.onToken(event.token ?? '');
  } else if (event.type === 'citations') {
    callbacks.onCitations(event.citations ?? []);
  } else if (event.type === 'done') {
    callbacks.onDone?.(event);
  } else if (event.type === 'error') {
    callbacks.onError?.(event.message);
  }
}
