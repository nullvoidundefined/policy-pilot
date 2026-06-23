import LoginPage from '@/app/(auth)/login/page';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLogin, mockUseAuth, mockRouterPush } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
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

vi.mock('@/components/Captain/Captain', () => ({
  default: ({ alt }: { alt?: string }) => (
    <img alt={alt ?? 'Captain'} src='/captain-stub.png' />
  ),
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

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ login: mockLogin });
  });

  it('renders the email and password labelled inputs', () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders the sign in submit button', () => {
    render(<LoginPage />);

    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it('calls login with the entered email and password on submit', async () => {
    mockLogin.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'pilot@airline.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(mockLogin).toHaveBeenCalledWith('pilot@airline.com', 'secret123');
  });

  it('redirects to /dashboard after a successful login', async () => {
    mockLogin.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'pilot@airline.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
  });

  it('disables the submit button while the login request is pending', async () => {
    let resolveLogin!: () => void;
    mockLogin.mockReturnValue(
      new Promise<void>((res) => {
        resolveLogin = res;
      }),
    );
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'pilot@airline.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();

    await act(async () => {
      resolveLogin();
    });
  });

  it('renders the API error message when login throws', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'pilot@airline.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid credentials',
    );
  });

  it('re-enables the submit button after an error', async () => {
    mockLogin.mockRejectedValue(new Error('Bad credentials'));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'pilot@airline.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
  });
});
