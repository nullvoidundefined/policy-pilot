import Header from '@/components/Header/Header';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('@/state/AuthContext', () => ({ useAuth: mockUseAuth }));

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    width,
    height,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
  }) => <img src={src} alt={alt} width={width} height={height} />,
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

describe('Header', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Sign In and hides Dashboard when signed out', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      logout: vi.fn(),
    });
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
  });

  it('shows the Dashboard link and a Log Out button when signed in', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', email: 'a@b.co' },
      isLoading: false,
      logout: vi.fn(),
    });
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log Out' })).toBeInTheDocument();
  });

  it('renders neither auth control while loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      logout: vi.fn(),
    });
    render(<Header />);

    expect(screen.queryByRole('button', { name: 'Log Out' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign In' })).toBeNull();
  });
});
