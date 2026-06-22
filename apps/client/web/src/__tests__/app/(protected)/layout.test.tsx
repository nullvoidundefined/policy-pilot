import ProtectedLayout from '@/app/(protected)/layout';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseAuth, mockRouterPush } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockRouterPush: vi.fn(),
}));

vi.mock('@/state/AuthContext', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn() }),
  useParams: () => ({}),
  redirect: vi.fn(),
  usePathname: () => '/',
}));

const STUB_USER = {
  id: 'u1',
  email: 'captain@airline.com',
  first_name: 'Captain',
  last_name: 'Pilot',
  created_at: '2024-01-01T00:00:00Z',
};

describe('ProtectedLayout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders children when a user is present and not loading', () => {
    mockUseAuth.mockReturnValue({ user: STUB_USER, isLoading: false });

    render(
      <ProtectedLayout>
        <p>Protected content</p>
      </ProtectedLayout>,
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('renders the loading state while auth is resolving', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true });

    render(
      <ProtectedLayout>
        <p>Protected content</p>
      </ProtectedLayout>,
    );

    expect(screen.getByText(/preparing for takeoff/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders the loading placeholder when signed out and still loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true });

    render(
      <ProtectedLayout>
        <p>Protected content</p>
      </ProtectedLayout>,
    );

    expect(screen.getByText(/preparing for takeoff/i)).toBeInTheDocument();
  });

  it('hides children and redirects to /login when signed out and not loading', async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });

    render(
      <ProtectedLayout>
        <p>Protected content</p>
      </ProtectedLayout>,
    );

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/login');
    });

    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('does not redirect when a user is present', async () => {
    mockUseAuth.mockReturnValue({ user: STUB_USER, isLoading: false });

    render(
      <ProtectedLayout>
        <p>Protected content</p>
      </ProtectedLayout>,
    );

    await waitFor(() => {
      expect(screen.getByText('Protected content')).toBeInTheDocument();
    });

    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
