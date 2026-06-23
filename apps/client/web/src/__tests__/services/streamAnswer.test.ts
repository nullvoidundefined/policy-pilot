import { streamPost } from '@/api/request';
import { streamAnswer } from '@/services/streamAnswer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/request', () => ({
  streamPost: vi.fn(),
}));

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('streamAnswer', () => {
  it('emits tokens in order and surfaces citations and the done event', async () => {
    vi.mocked(streamPost).mockResolvedValue(
      sseStream([
        'data: {"type":"citations","citations":[{"id":"c1"}]}\n',
        'data: {"type":"token","token":"Hello"}\n',
        'data: {"type":"token","token":" world"}\n',
        'data: {"type":"done","conversation_id":"conv-1"}\n',
      ]),
    );

    const tokens: string[] = [];
    let citations: unknown;
    let doneEvent: unknown;
    await streamAnswer(
      '/qa/stream',
      { question: 'hi' },
      {
        onToken: (token) => tokens.push(token),
        onCitations: (received) => {
          citations = received;
        },
        onDone: (event) => {
          doneEvent = event;
        },
      },
    );

    expect(tokens).toEqual(['Hello', ' world']);
    expect(citations).toEqual([{ id: 'c1' }]);
    expect(doneEvent).toMatchObject({ conversation_id: 'conv-1' });
  });

  it('reassembles an event split across chunk boundaries', async () => {
    vi.mocked(streamPost).mockResolvedValue(
      sseStream(['data: {"type":"to', 'ken","token":"Hi"}\n']),
    );

    const tokens: string[] = [];
    await streamAnswer(
      '/qa/stream',
      {},
      { onToken: (token) => tokens.push(token), onCitations: () => {} },
    );

    expect(tokens).toEqual(['Hi']);
  });

  it('skips comment lines and invalid JSON', async () => {
    vi.mocked(streamPost).mockResolvedValue(
      sseStream([
        ': keep-alive\n',
        'data: not-json\n',
        'data: {"type":"token","token":"ok"}\n',
      ]),
    );

    const tokens: string[] = [];
    await streamAnswer(
      '/qa/stream',
      {},
      { onToken: (token) => tokens.push(token), onCitations: () => {} },
    );

    expect(tokens).toEqual(['ok']);
  });

  it('passes the raw error message to onError', async () => {
    vi.mocked(streamPost).mockResolvedValue(
      sseStream(['data: {"type":"error","message":"boom"}\n']),
    );

    let errorMessage: string | undefined = 'unset';
    await streamAnswer(
      '/qa/stream',
      {},
      {
        onToken: () => {},
        onCitations: () => {},
        onError: (message) => {
          errorMessage = message;
        },
      },
    );

    expect(errorMessage).toBe('boom');
  });

  it('fires onStart exactly once after the stream opens', async () => {
    vi.mocked(streamPost).mockResolvedValue(
      sseStream(['data: {"type":"token","token":"x"}\n']),
    );

    const onStart = vi.fn();
    await streamAnswer(
      '/qa/stream',
      {},
      { onStart, onToken: () => {}, onCitations: () => {} },
    );

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('propagates a streamPost rejection so callers can show the error state', async () => {
    vi.mocked(streamPost).mockRejectedValue(new Error('Request failed (500)'));
    const onStart = vi.fn();

    await expect(
      streamAnswer(
        '/qa/stream',
        {},
        { onStart, onToken: () => {}, onCitations: () => {} },
      ),
    ).rejects.toThrow('Request failed (500)');
    expect(onStart).not.toHaveBeenCalled();
  });
});
