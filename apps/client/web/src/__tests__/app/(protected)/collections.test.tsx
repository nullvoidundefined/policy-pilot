import CollectionPage from '@/app/(protected)/collections/[id]/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockDel, mockPost, mockUploadFile, mockRouterPush } =
  vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockDel: vi.fn(),
    mockPost: vi.fn(),
    mockUploadFile: vi.fn(),
    mockRouterPush: vi.fn(),
  }));

vi.mock('@/api/request', () => ({
  get: mockGet,
  del: mockDel,
  post: mockPost,
  uploadFile: mockUploadFile,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn() }),
  useParams: () => ({ id: 'col-1' }),
  redirect: vi.fn(),
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/components/Captain/Captain', () => ({
  default: ({ alt }: { alt?: string }) => (
    <img alt={alt ?? 'Captain'} src='/captain-stub.png' />
  ),
}));

function buildQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderCollectionPage(queryClient = buildQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <CollectionPage />
    </QueryClientProvider>,
  );
}

const COLLECTION_DETAIL = {
  id: 'col-1',
  name: 'HR Handbook',
  description: 'All HR policies',
  is_demo: false,
  created_at: '2024-01-15T00:00:00Z',
};

const DEMO_COLLECTION_DETAIL = {
  id: 'col-demo',
  name: 'Demo Policies',
  description: null,
  is_demo: true,
  created_at: '2024-01-01T00:00:00Z',
};

const DOCUMENT_READY = {
  id: 'doc-1',
  filename: 'handbook.pdf',
  mime_type: 'application/pdf',
  size_bytes: 102400,
  status: 'ready',
  total_chunks: 12,
  error: null,
  rejection_reason: null,
  created_at: '2024-01-15T00:00:00Z',
};

const DOCUMENT_PENDING = {
  id: 'doc-2',
  filename: 'safety-guide.pdf',
  mime_type: 'application/pdf',
  size_bytes: 51200,
  status: 'pending',
  total_chunks: null,
  error: null,
  rejection_reason: null,
  created_at: '2024-01-16T00:00:00Z',
};

const DOCUMENT_FAILED = {
  id: 'doc-3',
  filename: 'corrupt.pdf',
  mime_type: 'application/pdf',
  size_bytes: 1024,
  status: 'failed',
  total_chunks: null,
  error: 'Parsing failed: unexpected end of file',
  rejection_reason: null,
  created_at: '2024-01-17T00:00:00Z',
};

const DOCUMENT_REJECTED = {
  id: 'doc-4',
  filename: 'unsupported.exe',
  mime_type: 'application/octet-stream',
  size_bytes: 2048,
  status: 'rejected',
  total_chunks: null,
  error: null,
  rejection_reason: 'File type not supported',
  created_at: '2024-01-18T00:00:00Z',
};

type TestCollection = {
  id: string;
  name: string;
  description: string | null;
  is_demo: boolean;
  created_at: string;
};

type TestDocument = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  total_chunks: number | null;
  error: string | null;
  rejection_reason: string | null;
  created_at: string;
};

function setupCollectionAndDocs(
  collection: TestCollection = COLLECTION_DETAIL,
  documents: TestDocument[] = [],
) {
  mockGet.mockImplementation((path: string) => {
    if (path === `/collections/col-1`) return Promise.resolve({ collection });
    if (path === `/collections/col-1/documents`)
      return Promise.resolve({ documents });
    return Promise.reject(new Error(`Unmocked GET: ${path}`));
  });
}

describe('CollectionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows the loading indicator while the collection query is in flight', () => {
      mockGet.mockReturnValue(new Promise(() => {}));
      renderCollectionPage();

      expect(
        screen.getByText(/scanning the flight manual/i),
      ).toBeInTheDocument();
    });
  });

  describe('not-found state', () => {
    it('shows turbulence message when the collection is not found', async () => {
      mockGet.mockResolvedValue({ collection: null });
      renderCollectionPage();

      expect(
        await screen.findByText(/turbulence.*collection not found/i),
      ).toBeInTheDocument();
    });
  });

  describe('rendered collection', () => {
    it('renders the collection name as a heading', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, []);
      renderCollectionPage();

      expect(
        await screen.findByRole('heading', { name: /hr handbook/i }),
      ).toBeInTheDocument();
    });

    it('renders the collection description when present', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, []);
      renderCollectionPage();

      expect(await screen.findByText(/all hr policies/i)).toBeInTheDocument();
    });

    it('shows the demo banner for is_demo collections', async () => {
      setupCollectionAndDocs(DEMO_COLLECTION_DETAIL, []);
      renderCollectionPage();

      expect(await screen.findByRole('status')).toHaveTextContent(
        /demo collection/i,
      );
    });
  });

  describe('documents loading state', () => {
    it('shows loading indicator while documents query is pending', async () => {
      mockGet.mockImplementation((path: string) => {
        if (path === `/collections/col-1`)
          return Promise.resolve({ collection: COLLECTION_DETAIL });
        return new Promise(() => {});
      });
      renderCollectionPage();

      await screen.findByRole('heading', { name: /hr handbook/i });
      expect(
        screen.getAllByText(/scanning the flight manual/i).length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe('empty documents state', () => {
    it('shows the empty hangar message when no documents exist', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, []);
      renderCollectionPage();

      expect(
        await screen.findByText(/the hangar is empty/i),
      ).toBeInTheDocument();
    });
  });

  describe('populated documents list', () => {
    it('renders each document filename', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, [
        DOCUMENT_READY,
        DOCUMENT_PENDING,
      ]);
      renderCollectionPage();

      expect(await screen.findByText('handbook.pdf')).toBeInTheDocument();
      expect(screen.getByText('safety-guide.pdf')).toBeInTheDocument();
    });

    it('renders the ready status label for a ready document', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, [DOCUMENT_READY]);
      renderCollectionPage();

      expect(
        await screen.findByText(/cleared for takeoff/i),
      ).toBeInTheDocument();
    });

    it('renders the processing status label for a pending document', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, [DOCUMENT_PENDING]);
      renderCollectionPage();

      expect(
        await screen.findByText(/preparing for takeoff/i),
      ).toBeInTheDocument();
    });

    it('renders the failed status and error message', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, [DOCUMENT_FAILED]);
      renderCollectionPage();

      expect(
        await screen.findByText(/turbulence encountered/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/parsing failed/i)).toBeInTheDocument();
    });

    it('renders the rejected status, reason, and Override button', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, [DOCUMENT_REJECTED]);
      renderCollectionPage();

      expect(
        await screen.findByText(/redirected to another gate/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/file type not supported/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: /override rejection for unsupported.exe/i,
        }),
      ).toBeInTheDocument();
    });

    it('renders a delete button for each document', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, [DOCUMENT_READY]);
      renderCollectionPage();

      expect(
        await screen.findByRole('button', { name: /delete handbook.pdf/i }),
      ).toBeInTheDocument();
    });

    it('renders formatted file size', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, [DOCUMENT_READY]);
      renderCollectionPage();

      expect(await screen.findByText(/100\.0 KB/i)).toBeInTheDocument();
    });

    it('renders chunk count when total_chunks is available', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, [DOCUMENT_READY]);
      renderCollectionPage();

      expect(await screen.findByText(/12 chunks/i)).toBeInTheDocument();
    });
  });

  describe('upload flow', () => {
    it('calls uploadFile with a FormData containing the file and collection_id', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, []);
      mockUploadFile.mockResolvedValue({ document: { id: 'doc-new' } });
      const user = userEvent.setup();
      renderCollectionPage();

      await screen.findByRole('heading', { name: /hr handbook/i });

      const fileInput = screen.getByLabelText(/upload document/i);
      const fakeFile = new File(['content'], 'contract.pdf', {
        type: 'application/pdf',
      });
      await user.upload(fileInput, fakeFile);

      await waitFor(() => {
        expect(mockUploadFile).toHaveBeenCalledTimes(1);
        const [path, formData] = mockUploadFile.mock.calls[0] as [
          string,
          FormData,
        ];
        expect(path).toBe('/documents');
        expect(formData.get('collection_id')).toBe('col-1');
        expect(formData.get('file')).toBe(fakeFile);
      });
    });

    it('shows upload error when uploadFile rejects', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, []);
      mockUploadFile.mockRejectedValue(new Error('File too large'));
      const user = userEvent.setup();
      renderCollectionPage();

      await screen.findByRole('heading', { name: /hr handbook/i });

      const fileInput = screen.getByLabelText(/upload document/i);
      const fakeFile = new File(['content'], 'big.pdf', {
        type: 'application/pdf',
      });
      await user.upload(fileInput, fakeFile);

      expect(await screen.findByText(/file too large/i)).toBeInTheDocument();
    });

    it('disables upload button while upload is in flight', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, []);
      let resolveUpload!: () => void;
      mockUploadFile.mockReturnValue(
        new Promise<void>((res) => {
          resolveUpload = res;
        }),
      );
      const user = userEvent.setup();
      renderCollectionPage();

      await screen.findByRole('heading', { name: /hr handbook/i });

      const fileInput = screen.getByLabelText(/upload document/i);
      const fakeFile = new File(['content'], 'doc.pdf', {
        type: 'application/pdf',
      });
      await user.upload(fileInput, fakeFile);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /upload a document/i }),
        ).toBeDisabled();
      });

      await act(async () => {
        resolveUpload();
      });
    });

    it('disables the Upload Document button for demo collections', async () => {
      setupCollectionAndDocs(DEMO_COLLECTION_DETAIL, []);
      renderCollectionPage();

      await screen.findByRole('heading', { name: /demo policies/i });
      expect(
        screen.getByRole('button', { name: /upload a document/i }),
      ).toBeDisabled();
    });
  });

  describe('delete-document flow', () => {
    it('calls del with the correct document path when Delete is clicked', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, [DOCUMENT_READY]);
      mockDel.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderCollectionPage();

      await user.click(
        await screen.findByRole('button', { name: /delete handbook.pdf/i }),
      );

      await waitFor(() => {
        expect(mockDel).toHaveBeenCalledWith('/documents/doc-1');
      });
    });

    it('optimistically removes the document from the list before the request completes', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, [DOCUMENT_READY]);
      let resolveDelete!: () => void;
      mockDel.mockReturnValue(
        new Promise<void>((res) => {
          resolveDelete = res;
        }),
      );
      const user = userEvent.setup();
      renderCollectionPage();

      await screen.findByText('handbook.pdf');
      await user.click(
        screen.getByRole('button', { name: /delete handbook.pdf/i }),
      );

      await waitFor(() => {
        expect(screen.queryByText('handbook.pdf')).toBeNull();
      });

      await act(async () => {
        resolveDelete();
      });
    });
  });

  describe('Start Chatting button', () => {
    it('navigates to the chat route for this collection when Start Chatting is clicked', async () => {
      setupCollectionAndDocs(COLLECTION_DETAIL, []);
      const user = userEvent.setup();
      renderCollectionPage();

      await user.click(
        await screen.findByRole('button', {
          name: /start chatting about this collection/i,
        }),
      );

      expect(mockRouterPush).toHaveBeenCalledWith('/chat/col-1');
    });
  });
});
