/** Tests for the chat/[collectionId] page: initial state, streaming Q&A, citation panel, and conversation list. */
import CollectionChatPage from '@/app/(protected)/chat/[collectionId]/page';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGet, mockLogout, mockUseAuth } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockLogout: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/state/AuthContext', () => ({ useAuth: mockUseAuth }));

vi.mock('@/api/request', () => ({
  get: mockGet,
  API_BASE: 'http://localhost:3001',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ collectionId: 'col-1' }),
  redirect: vi.fn(),
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/Captain/Captain', () => ({
  default: ({ alt }: { alt?: string }) => (
    <img alt={alt ?? 'Captain'} src='/captain-stub.png' />
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COLLECTION_INFO = { id: 'col-1', name: 'HR Handbook' };

const CONVERSATION_A = {
  id: 'conv-1',
  title: 'Vacation Policy',
  created_at: '2024-03-10T12:00:00Z',
};

function setupDefaultGet() {
  mockGet.mockImplementation((path: string) => {
    if (path === '/collections/col-1')
      return Promise.resolve({ collection: COLLECTION_INFO });
    if (path === '/collections/col-1/conversations')
      return Promise.resolve({ conversations: [] });
    if (path === '/conversations/conv-1/messages')
      return Promise.resolve({ messages: [] });
    return Promise.reject(new Error(`Unmocked GET: ${path}`));
  });
}

/**
 * Build a ReadableStream that emits SSE-formatted lines exactly as the chat
 * page parser expects: each line is "data: <JSON>\n", followed by a blank
 * line. The page splits on "\n", skips non-"data: " lines, and slices off
 * "data: " before JSON.parse.
 */
function buildSseStream(events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const raw = events.map((ev) => `data: ${JSON.stringify(ev)}\n\n`).join('');
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(raw));
      controller.close();
    },
  });
}

function mockFetchStream(stream: ReadableStream<Uint8Array>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    // CSRF token endpoint
    if (url.includes('/api/csrf-token')) {
      return new Response(JSON.stringify({ token: 'test-csrf' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // QA streaming endpoint
    if (url.includes('/qa')) {
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    return new Response('Not found', { status: 404 });
  });
}

function renderChatPage() {
  return render(<CollectionChatPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollectionChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ logout: mockLogout });
    setupDefaultGet();
    // jsdom does not implement scrollIntoView; stub it to prevent unhandled errors.
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  // -----------------------------------------------------------------------
  // Initial / empty state
  // -----------------------------------------------------------------------

  describe('initial state', () => {
    it('renders the page heading', async () => {
      renderChatPage();
      expect(
        await screen.findByRole('heading', { name: /ask your policy/i }),
      ).toBeInTheDocument();
    });

    it('renders the empty-state prompt when no messages are present', async () => {
      renderChatPage();
      expect(
        await screen.findByText(/ready for your questions, co-pilot/i),
      ).toBeInTheDocument();
    });

    it('renders the chat input and send button', async () => {
      renderChatPage();
      expect(
        await screen.findByRole('textbox', { name: /ask a question/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    it('shows "No conversations yet" when the sidebar has no history', async () => {
      renderChatPage();
      expect(
        await screen.findByText(/no conversations yet/i),
      ).toBeInTheDocument();
    });

    it('displays the collection name as a back-link once loaded', async () => {
      renderChatPage();
      expect(
        await screen.findByRole('link', { name: /hr handbook/i }),
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Conversation sidebar
  // -----------------------------------------------------------------------

  describe('conversation sidebar', () => {
    it('renders a conversation entry when conversations are returned', async () => {
      mockGet.mockImplementation((path: string) => {
        if (path === '/collections/col-1')
          return Promise.resolve({ collection: COLLECTION_INFO });
        if (path === '/collections/col-1/conversations')
          return Promise.resolve({ conversations: [CONVERSATION_A] });
        return Promise.reject(new Error(`Unmocked GET: ${path}`));
      });
      renderChatPage();
      expect(await screen.findByText(/vacation policy/i)).toBeInTheDocument();
    });

    it('loads messages when a conversation entry is clicked', async () => {
      const loadedMessages = [
        { role: 'user', content: 'What is the PTO policy?' },
        {
          role: 'assistant',
          content: 'You have 20 days per year.',
          citations: [],
        },
      ];
      mockGet.mockImplementation((path: string) => {
        if (path === '/collections/col-1')
          return Promise.resolve({ collection: COLLECTION_INFO });
        if (path === '/collections/col-1/conversations')
          return Promise.resolve({ conversations: [CONVERSATION_A] });
        if (path === '/conversations/conv-1/messages')
          return Promise.resolve({ messages: loadedMessages });
        return Promise.reject(new Error(`Unmocked GET: ${path}`));
      });

      const user = userEvent.setup();
      renderChatPage();

      await user.click(await screen.findByText(/vacation policy/i));

      expect(
        await screen.findByText(/what is the pto policy\?/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/you have 20 days per year\./i),
      ).toBeInTheDocument();
    });

    it('clears messages and conversation id when New is clicked', async () => {
      const loadedMessages = [
        { role: 'user', content: 'Test question' },
        { role: 'assistant', content: 'Test answer', citations: [] },
      ];
      mockGet.mockImplementation((path: string) => {
        if (path === '/collections/col-1')
          return Promise.resolve({ collection: COLLECTION_INFO });
        if (path === '/collections/col-1/conversations')
          return Promise.resolve({ conversations: [CONVERSATION_A] });
        if (path === '/conversations/conv-1/messages')
          return Promise.resolve({ messages: loadedMessages });
        return Promise.reject(new Error(`Unmocked GET: ${path}`));
      });

      const user = userEvent.setup();
      renderChatPage();

      await user.click(await screen.findByText(/vacation policy/i));
      await screen.findByText(/test question/i);

      await user.click(
        screen.getByRole('button', { name: /start new conversation/i }),
      );

      await waitFor(() => {
        expect(screen.queryByText(/test question/i)).toBeNull();
      });
      expect(
        await screen.findByText(/ready for your questions, co-pilot/i),
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Streaming Q&A
  // -----------------------------------------------------------------------

  describe('streaming Q&A', () => {
    it('appends the user question to the message thread immediately', async () => {
      const stream = buildSseStream([
        { type: 'token', token: 'Hello ' },
        { type: 'token', token: 'world.' },
        { type: 'done', conversation_id: 'conv-new' },
      ]);
      mockFetchStream(stream);

      const user = userEvent.setup();
      renderChatPage();

      await user.type(
        await screen.findByRole('textbox', { name: /ask a question/i }),
        'What is PTO?',
      );
      await user.click(screen.getByRole('button', { name: /send/i }));

      expect(await screen.findByText('What is PTO?')).toBeInTheDocument();
    });

    it('renders the streamed answer text after the stream drains', async () => {
      const stream = buildSseStream([
        { type: 'token', token: 'You have ' },
        { type: 'token', token: '20 days.' },
        { type: 'done', conversation_id: 'conv-new' },
      ]);
      mockFetchStream(stream);

      const user = userEvent.setup();
      renderChatPage();

      await user.type(
        await screen.findByRole('textbox', { name: /ask a question/i }),
        'How many PTO days?',
      );
      await user.click(screen.getByRole('button', { name: /send/i }));

      expect(
        await screen.findByText(/you have 20 days\./i),
      ).toBeInTheDocument();
    });

    it('shows the loading indicator while the stream is in flight', async () => {
      let releaseStream!: () => void;
      const releasePromise = new Promise<void>((resolve) => {
        releaseStream = resolve;
      });
      const blockingStream = new ReadableStream<Uint8Array>({
        start(controller) {
          releasePromise.then(() => {
            controller.close();
          });
        },
      });

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        if (url.includes('/api/csrf-token')) {
          return new Response(JSON.stringify({ token: 'test-csrf' }), {
            status: 200,
          });
        }
        return new Response(blockingStream, { status: 200 });
      });

      const user = userEvent.setup();
      renderChatPage();

      await user.type(
        await screen.findByRole('textbox', { name: /ask a question/i }),
        'Streaming question',
      );
      await user.click(screen.getByRole('button', { name: /send/i }));

      expect(
        await screen.findByText(/scanning the flight manual/i),
      ).toBeInTheDocument();

      await act(async () => {
        releaseStream();
        await releasePromise;
      });
    });

    it('clears the input field after submitting a question', async () => {
      const stream = buildSseStream([
        { type: 'done', conversation_id: 'conv-new' },
      ]);
      mockFetchStream(stream);

      const user = userEvent.setup();
      renderChatPage();

      const input = await screen.findByRole('textbox', {
        name: /ask a question/i,
      });
      await user.type(input, 'Test question');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('renders an error message when the fetch call fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        if (url.includes('/api/csrf-token')) {
          return new Response(JSON.stringify({ token: 'test-csrf' }), {
            status: 200,
          });
        }
        return new Response('Internal Server Error', { status: 500 });
      });

      const user = userEvent.setup();
      renderChatPage();

      await user.type(
        await screen.findByRole('textbox', { name: /ask a question/i }),
        'Will this fail?',
      );
      await user.click(screen.getByRole('button', { name: /send/i }));

      expect(
        await screen.findByText(/we've hit some turbulence/i),
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Citation panel
  // -----------------------------------------------------------------------

  describe('citation panel', () => {
    const CITATION = {
      id: 'chunk-1',
      document_id: 'doc-1',
      chunk_index: 2,
      content: 'Employees receive 20 days of PTO.',
      filename: 'handbook.pdf',
    };

    it('opens the citation panel when a citation badge is clicked', async () => {
      // Stream: citations event followed by a token referencing [1]
      const stream = buildSseStream([
        { type: 'citations', citations: [CITATION] },
        { type: 'token', token: 'See policy [1] for details.' },
        { type: 'done', conversation_id: 'conv-new' },
      ]);
      mockFetchStream(stream);

      const user = userEvent.setup();
      renderChatPage();

      await user.type(
        await screen.findByRole('textbox', { name: /ask a question/i }),
        'What is PTO?',
      );
      await user.click(screen.getByRole('button', { name: /send/i }));

      const badge = await screen.findByRole('button', {
        name: /view source 1/i,
      });
      await user.click(badge);

      expect(
        await screen.findByRole('complementary', { name: /citation details/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/employees receive 20 days of pto/i),
      ).toBeInTheDocument();
      expect(screen.getByText('handbook.pdf')).toBeInTheDocument();
    });

    it('closes the citation panel when the close button is clicked', async () => {
      const stream = buildSseStream([
        { type: 'citations', citations: [CITATION] },
        { type: 'token', token: 'See policy [1] here.' },
        { type: 'done', conversation_id: 'conv-new' },
      ]);
      mockFetchStream(stream);

      const user = userEvent.setup();
      renderChatPage();

      await user.type(
        await screen.findByRole('textbox', { name: /ask a question/i }),
        'What is PTO?',
      );
      await user.click(screen.getByRole('button', { name: /send/i }));

      const badge = await screen.findByRole('button', {
        name: /view source 1/i,
      });
      await user.click(badge);

      await screen.findByRole('complementary', { name: /citation details/i });

      await user.click(
        screen.getByRole('button', { name: /close citation panel/i }),
      );

      await waitFor(() => {
        expect(
          screen.queryByRole('complementary', { name: /citation details/i }),
        ).toBeNull();
      });
    });
  });

  // -----------------------------------------------------------------------
  // Logout
  // -----------------------------------------------------------------------

  describe('logout', () => {
    it('calls logout when the Log Out button is clicked', async () => {
      renderChatPage();
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: /log out/i }));

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });
});
