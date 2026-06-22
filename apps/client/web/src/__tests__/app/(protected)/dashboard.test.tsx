import DashboardPage from '@/app/(protected)/dashboard/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetCollections,
  mockCreateCollection,
  mockDeleteCollection,
  mockLogout,
  mockUseAuth,
} = vi.hoisted(() => ({
  mockGetCollections: vi.fn(),
  mockCreateCollection: vi.fn(),
  mockDeleteCollection: vi.fn(),
  mockLogout: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/state/AuthContext', () => ({ useAuth: mockUseAuth }));

vi.mock('@/api/getCollections', () => ({ getCollections: mockGetCollections }));
vi.mock('@/api/createCollection', () => ({
  createCollection: mockCreateCollection,
}));
vi.mock('@/api/deleteCollection', () => ({
  deleteCollection: mockDeleteCollection,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({}),
  redirect: vi.fn(),
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    'aria-label': ariaLabel,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    'aria-label'?: string;
    className?: string;
  }) => (
    <a href={href} aria-label={ariaLabel} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/Captain/Captain', () => ({
  default: ({ alt }: { alt?: string }) => (
    <img alt={alt ?? 'Captain'} src='/captain-stub.png' />
  ),
}));

function buildQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderDashboard(queryClient = buildQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

const COLLECTION_A = {
  id: 'col-1',
  name: 'HR Handbook',
  description: 'HR policies',
  is_demo: false,
  document_count: 3,
  created_at: '2024-01-15T00:00:00Z',
};

const DEMO_COLLECTION = {
  id: 'col-demo',
  name: 'Demo Policies',
  description: null,
  is_demo: true,
  document_count: 5,
  created_at: '2024-01-01T00:00:00Z',
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ logout: mockLogout });
  });

  describe('loading state', () => {
    it('shows the loading indicator while the query is in flight', () => {
      mockGetCollections.mockReturnValue(new Promise(() => {}));
      renderDashboard();

      expect(
        screen.getByText(/scanning the flight manifest/i),
      ).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows the empty-state message when no collections are returned', async () => {
      mockGetCollections.mockResolvedValue({ collections: [] });
      renderDashboard();

      await screen.findByText(/no collections yet/i);
    });
  });

  describe('populated list', () => {
    it('renders each collection name as a link', async () => {
      mockGetCollections.mockResolvedValue({
        collections: [COLLECTION_A, DEMO_COLLECTION],
      });
      renderDashboard();

      expect(
        await screen.findByRole('link', {
          name: /open collection: hr handbook/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /open collection: demo policies/i }),
      ).toBeInTheDocument();
    });

    it('renders the document count for each collection', async () => {
      mockGetCollections.mockResolvedValue({ collections: [COLLECTION_A] });
      renderDashboard();

      expect(await screen.findByText(/3 docs/i)).toBeInTheDocument();
    });

    it('renders a Demo badge for is_demo collections', async () => {
      mockGetCollections.mockResolvedValue({ collections: [DEMO_COLLECTION] });
      renderDashboard();

      expect(await screen.findByText('Demo')).toBeInTheDocument();
    });

    it('renders a delete button for non-demo collections only', async () => {
      mockGetCollections.mockResolvedValue({
        collections: [COLLECTION_A, DEMO_COLLECTION],
      });
      renderDashboard();

      await screen.findByRole('button', {
        name: /delete collection hr handbook/i,
      });
      expect(
        screen.queryByRole('button', {
          name: /delete collection demo policies/i,
        }),
      ).toBeNull();
    });
  });

  describe('create-collection flow', () => {
    it('shows the create form when New Collection is clicked', async () => {
      mockGetCollections.mockResolvedValue({ collections: [] });
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole('button', { name: /new collection/i }));

      expect(
        screen.getByRole('form', { name: /create new collection/i }),
      ).toBeInTheDocument();
    });

    it('calls createCollection with the entered name and optional description', async () => {
      mockGetCollections.mockResolvedValue({ collections: [] });
      mockCreateCollection.mockResolvedValue({ collection: { id: 'col-new' } });
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole('button', { name: /new collection/i }));
      await user.type(screen.getByLabelText(/^name$/i), 'Safety Manual');
      await user.type(screen.getByLabelText(/description/i), 'All safety docs');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => {
        expect(mockCreateCollection).toHaveBeenCalledWith(
          'Safety Manual',
          'All safety docs',
        );
      });
    });

    it('calls createCollection with undefined description when the description field is empty', async () => {
      mockGetCollections.mockResolvedValue({ collections: [] });
      mockCreateCollection.mockResolvedValue({ collection: { id: 'col-new' } });
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole('button', { name: /new collection/i }));
      await user.type(screen.getByLabelText(/^name$/i), 'Safety Manual');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => {
        expect(mockCreateCollection).toHaveBeenCalledWith(
          'Safety Manual',
          undefined,
        );
      });
    });

    it('hides the form and clears inputs after a successful create', async () => {
      mockGetCollections.mockResolvedValue({ collections: [] });
      mockCreateCollection.mockResolvedValue({ collection: { id: 'col-new' } });
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole('button', { name: /new collection/i }));
      await user.type(screen.getByLabelText(/^name$/i), 'Safety Manual');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => {
        expect(
          screen.queryByRole('form', { name: /create new collection/i }),
        ).toBeNull();
      });
    });

    it('shows an error message when createCollection rejects', async () => {
      mockGetCollections.mockResolvedValue({ collections: [] });
      mockCreateCollection.mockRejectedValue(new Error('Name already taken'));
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole('button', { name: /new collection/i }));
      await user.type(screen.getByLabelText(/^name$/i), 'Duplicate');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      expect(
        await screen.findByText(/name already taken/i),
      ).toBeInTheDocument();
    });

    it('shows filing flight plan text while the create request is pending', async () => {
      let resolveCreate!: () => void;
      mockGetCollections.mockResolvedValue({ collections: [] });
      mockCreateCollection.mockReturnValue(
        new Promise<void>((res) => {
          resolveCreate = res;
        }),
      );
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole('button', { name: /new collection/i }));
      await user.type(screen.getByLabelText(/^name$/i), 'In Progress');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      expect(
        await screen.findByRole('button', { name: /filing flight plan/i }),
      ).toBeDisabled();

      await act(async () => {
        resolveCreate();
      });
    });
  });

  describe('delete flow', () => {
    it('calls deleteCollection with the collection id when Delete is clicked', async () => {
      mockGetCollections.mockResolvedValue({ collections: [COLLECTION_A] });
      mockDeleteCollection.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderDashboard();

      await user.click(
        await screen.findByRole('button', {
          name: /delete collection hr handbook/i,
        }),
      );

      await waitFor(() => {
        expect(mockDeleteCollection).toHaveBeenCalledWith('col-1');
      });
    });

    it('optimistically removes the collection from the list before the request completes', async () => {
      let resolveDelete!: () => void;
      mockGetCollections.mockResolvedValue({ collections: [COLLECTION_A] });
      mockDeleteCollection.mockReturnValue(
        new Promise<void>((res) => {
          resolveDelete = res;
        }),
      );
      const user = userEvent.setup();
      renderDashboard();

      await screen.findByRole('button', {
        name: /delete collection hr handbook/i,
      });
      await user.click(
        screen.getByRole('button', { name: /delete collection hr handbook/i }),
      );

      await waitFor(() => {
        expect(
          screen.queryByRole('button', {
            name: /delete collection hr handbook/i,
          }),
        ).toBeNull();
      });

      await act(async () => {
        resolveDelete();
      });
    });
  });

  describe('logout', () => {
    it('calls logout when the Log Out button is clicked', async () => {
      mockGetCollections.mockResolvedValue({ collections: [] });
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole('button', { name: /log out/i }));

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });
});
