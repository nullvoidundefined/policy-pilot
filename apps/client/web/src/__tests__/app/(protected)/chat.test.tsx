import ChatRedirectPage from '@/app/(protected)/chat/page';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRouterReplace } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockRouterReplace }),
  useParams: () => ({}),
  redirect: vi.fn(),
  usePathname: () => '/',
}));

describe('ChatRedirectPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the redirecting placeholder text', () => {
    render(<ChatRedirectPage />);

    expect(
      screen.getByText(/redirecting to your flight plans/i),
    ).toBeInTheDocument();
  });

  it('calls router.replace with /dashboard on mount', async () => {
    render(<ChatRedirectPage />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/dashboard');
    });
  });
});
