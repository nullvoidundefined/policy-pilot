/** Tests for the public demo page: initial state, scripted Q&A flow, collection picker, citation panel, and error branch. */
import DemoPage from '@/app/demo/page';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

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
// Fixtures
// ---------------------------------------------------------------------------

const VALVE_COLLECTION = {
  id: 'col-valve',
  name: 'Valve Handbook',
  description: 'Valve employee handbook',
};

const GITLAB_COLLECTION = {
  id: 'col-gitlab',
  name: 'GitLab Handbook',
  description: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a ReadableStream that emits SSE-formatted lines exactly as the demo
 * page parser expects: "data: <JSON>\n\n" per event.
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

function mockFetchWithStream(
  collections: (typeof VALVE_COLLECTION)[],
  stream: ReadableStream<Uint8Array>,
) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url;

    // Demo collections endpoint
    if (url.includes('/collections/demo')) {
      return new Response(JSON.stringify({ collections }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
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

function mockFetchCollectionsOnly(collections: (typeof VALVE_COLLECTION)[]) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (url.includes('/collections/demo')) {
      return new Response(JSON.stringify({ collections }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not found', { status: 404 });
  });
}

function renderDemoPage() {
  return render(<DemoPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DemoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom does not implement scrollIntoView; stub it to prevent unhandled errors.
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------

  describe('initial state', () => {
    it('renders the demo heading', async () => {
      mockFetchCollectionsOnly([VALVE_COLLECTION]);
      renderDemoPage();
      expect(
        await screen.findByRole('heading', { name: /demo/i }),
      ).toBeInTheDocument();
    });

    it('renders the signup banner with a Join the Crew link', async () => {
      mockFetchCollectionsOnly([VALVE_COLLECTION]);
      renderDemoPage();
      expect(await screen.findByRole('status')).toHaveTextContent(
        /demo flight/i,
      );
      expect(
        screen.getByRole('link', { name: /join the crew/i }),
      ).toBeInTheDocument();
    });

    it('renders the empty-state welcome message before any question is asked', async () => {
      mockFetchCollectionsOnly([VALVE_COLLECTION]);
      renderDemoPage();
      expect(
        await screen.findByText(/welcome aboard, passenger/i),
      ).toBeInTheDocument();
    });

    it('renders example questions for the Valve collection', async () => {
      mockFetchCollectionsOnly([VALVE_COLLECTION]);
      renderDemoPage();
      expect(
        await screen.findByRole('button', {
          name: /how do employees choose what to work on at valve\?/i,
        }),
      ).toBeInTheDocument();
    });

    it('renders the chat input and send button', async () => {
      mockFetchCollectionsOnly([VALVE_COLLECTION]);
      renderDemoPage();
      expect(
        await screen.findByRole('textbox', { name: /ask a question/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    it('renders navigation links to Sign In and Get Started', async () => {
      mockFetchCollectionsOnly([VALVE_COLLECTION]);
      renderDemoPage();
      await screen.findByRole('heading', { name: /demo/i });
      expect(
        screen.getByRole('link', { name: /sign in/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /get started/i }),
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Load error branch
  // -----------------------------------------------------------------------

  describe('load error branch', () => {
    it('shows the error state when the demo collections fetch fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response('Server Error', { status: 500 });
      });
      renderDemoPage();
      expect(
        await screen.findByText(/demo collections are currently unavailable/i),
      ).toBeInTheDocument();
    });

    it('shows the turbulence heading in the error state', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response('Server Error', { status: 500 });
      });
      renderDemoPage();
      expect(
        await screen.findByRole('heading', { name: /hit some turbulence/i }),
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Collection picker (multi-collection)
  // -----------------------------------------------------------------------

  describe('collection picker', () => {
    it('renders a select when more than one demo collection is returned', async () => {
      mockFetchCollectionsOnly([VALVE_COLLECTION, GITLAB_COLLECTION]);
      renderDemoPage();
      expect(
        await screen.findByRole('combobox', {
          name: /select a demo collection/i,
        }),
      ).toBeInTheDocument();
    });

    it('does not render a select when only one collection is returned', async () => {
      mockFetchCollectionsOnly([VALVE_COLLECTION]);
      renderDemoPage();
      await screen.findByText(/welcome aboard, passenger/i);
      expect(
        screen.queryByRole('combobox', { name: /select a demo collection/i }),
      ).toBeNull();
    });

    it('clears the message thread when a different collection is selected', async () => {
      const stream = buildSseStream([
        { type: 'token', token: 'Valve answer.' },
        { type: 'done' },
      ]);
      mockFetchWithStream([VALVE_COLLECTION, GITLAB_COLLECTION], stream);

      const user = userEvent.setup();
      renderDemoPage();

      // Ask a question to populate the thread
      await user.type(
        await screen.findByRole('textbox', { name: /ask a question/i }),
        'Valve question?',
      );
      await user.click(screen.getByRole('button', { name: /send/i }));
      await screen.findByText('Valve question?');

      // Switch collection
      const picker = screen.getByRole('combobox', {
        name: /select a demo collection/i,
      });
      await user.selectOptions(picker, GITLAB_COLLECTION.id);

      await waitFor(() => {
        expect(screen.queryByText('Valve question?')).toBeNull();
      });
    });
  });

  // -----------------------------------------------------------------------
  // Scripted Q&A flow (happy path)
  // -----------------------------------------------------------------------

  describe('Q&A happy path', () => {
    it('appends the user question to the thread when submitted via the form', async () => {
      const stream = buildSseStream([
        { type: 'token', token: 'Yes, that is correct.' },
        { type: 'done' },
      ]);
      mockFetchWithStream([VALVE_COLLECTION], stream);

      const user = userEvent.setup();
      renderDemoPage();

      await user.type(
        await screen.findByRole('textbox', { name: /ask a question/i }),
        'Is this a test?',
      );
      await user.click(screen.getByRole('button', { name: /send/i }));

      expect(await screen.findByText('Is this a test?')).toBeInTheDocument();
    });

    it('renders the streamed answer text after the stream drains', async () => {
      const stream = buildSseStream([
        { type: 'token', token: 'Valve has no managers.' },
        { type: 'done' },
      ]);
      mockFetchWithStream([VALVE_COLLECTION], stream);

      const user = userEvent.setup();
      renderDemoPage();

      await user.type(
        await screen.findByRole('textbox', { name: /ask a question/i }),
        'How does Valve work?',
      );
      await user.click(screen.getByRole('button', { name: /send/i }));

      expect(
        await screen.findByText(/valve has no managers\./i),
      ).toBeInTheDocument();
    });

    it('asks a question when an example question button is clicked', async () => {
      const stream = buildSseStream([
        { type: 'token', token: 'Self-directed work.' },
        { type: 'done' },
      ]);
      mockFetchWithStream([VALVE_COLLECTION], stream);

      const user = userEvent.setup();
      renderDemoPage();

      const exampleBtn = await screen.findByRole('button', {
        name: /how do employees choose what to work on at valve\?/i,
      });
      await user.click(exampleBtn);

      expect(
        await screen.findByText(
          /how do employees choose what to work on at valve\?/i,
          {
            selector: 'p',
          },
        ),
      ).toBeInTheDocument();
    });

    it('shows the loading indicator while the stream is in flight', async () => {
      let releaseStream!: () => void;
      const releasePromise = new Promise<void>((resolve) => {
        releaseStream = resolve;
      });
      const blockingStream = new ReadableStream<Uint8Array>({
        start(controller) {
          void releasePromise.then(() => {
            controller.close();
          });
        },
      });

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        if (url.includes('/collections/demo')) {
          return new Response(
            JSON.stringify({ collections: [VALVE_COLLECTION] }),
            { status: 200 },
          );
        }
        if (url.includes('/api/csrf-token')) {
          return new Response(JSON.stringify({ token: 'test-csrf' }), {
            status: 200,
          });
        }
        return new Response(blockingStream, { status: 200 });
      });

      const user = userEvent.setup();
      renderDemoPage();

      await user.type(
        await screen.findByRole('textbox', { name: /ask a question/i }),
        'Loading test question',
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

    it('renders the turbulence error message when the QA fetch fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        if (url.includes('/collections/demo')) {
          return new Response(
            JSON.stringify({ collections: [VALVE_COLLECTION] }),
            { status: 200 },
          );
        }
        if (url.includes('/api/csrf-token')) {
          return new Response(JSON.stringify({ token: 'test-csrf' }), {
            status: 200,
          });
        }
        return new Response('Internal Server Error', { status: 500 });
      });

      const user = userEvent.setup();
      renderDemoPage();

      await user.type(
        await screen.findByRole('textbox', { name: /ask a question/i }),
        'Failing question',
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
      id: 'chunk-2',
      document_id: 'doc-valve',
      chunk_index: 0,
      content: 'At Valve, employees self-organize.',
      filename: 'valve-handbook.pdf',
    };

    it('opens the citation panel when a citation badge is clicked', async () => {
      const stream = buildSseStream([
        { type: 'citations', citations: [CITATION] },
        { type: 'token', token: 'Read more [1] here.' },
        { type: 'done' },
      ]);
      mockFetchWithStream([VALVE_COLLECTION], stream);

      const user = userEvent.setup();
      renderDemoPage();

      await user.type(
        await screen.findByRole('textbox', { name: /ask a question/i }),
        'How does Valve work?',
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
        screen.getByText(/at valve, employees self-organize\./i),
      ).toBeInTheDocument();
    });

    it('closes the citation panel when the close button is clicked', async () => {
      const stream = buildSseStream([
        { type: 'citations', citations: [CITATION] },
        { type: 'token', token: 'Details in [1].' },
        { type: 'done' },
      ]);
      mockFetchWithStream([VALVE_COLLECTION], stream);

      const user = userEvent.setup();
      renderDemoPage();

      await user.type(
        await screen.findByRole('textbox', { name: /ask a question/i }),
        'How does Valve work?',
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
});
