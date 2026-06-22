import RegisterPage from '@/app/(auth)/register/page';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSignup, mockUseAuth, mockRouterPush } = vi.hoisted(() => ({
  mockSignup: vi.fn(),
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

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ signup: mockSignup });
  });

  it('renders first name, last name, email, and password fields', () => {
    render(<RegisterPage />);

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders the create account submit button', () => {
    render(<RegisterPage />);

    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it('calls signup with all four field values on submit', async () => {
    mockSignup.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/first name/i), 'Ada');
    await user.type(screen.getByLabelText(/last name/i), 'Lovelace');
    await user.type(screen.getByLabelText(/email/i), 'ada@computing.com');
    await user.type(screen.getByLabelText(/password/i), 'engineroom42');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(mockSignup).toHaveBeenCalledWith(
      'ada@computing.com',
      'engineroom42',
      'Ada',
      'Lovelace',
    );
  });

  it('redirects to /dashboard after successful registration', async () => {
    mockSignup.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/first name/i), 'Ada');
    await user.type(screen.getByLabelText(/last name/i), 'Lovelace');
    await user.type(screen.getByLabelText(/email/i), 'ada@computing.com');
    await user.type(screen.getByLabelText(/password/i), 'engineroom42');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
  });

  it('disables the submit button while the signup request is pending', async () => {
    let resolveSignup!: () => void;
    mockSignup.mockReturnValue(
      new Promise<void>((res) => {
        resolveSignup = res;
      }),
    );
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/first name/i), 'Ada');
    await user.type(screen.getByLabelText(/last name/i), 'Lovelace');
    await user.type(screen.getByLabelText(/email/i), 'ada@computing.com');
    await user.type(screen.getByLabelText(/password/i), 'engineroom42');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      screen.getByRole('button', { name: /creating account/i }),
    ).toBeDisabled();

    await act(async () => {
      resolveSignup();
    });
  });

  it('renders the API error message when signup throws', async () => {
    mockSignup.mockRejectedValue(new Error('Email already registered'));
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/first name/i), 'Ada');
    await user.type(screen.getByLabelText(/last name/i), 'Lovelace');
    await user.type(screen.getByLabelText(/email/i), 'ada@computing.com');
    await user.type(screen.getByLabelText(/password/i), 'engineroom42');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email already registered',
    );
  });

  it('re-enables the submit button after an error', async () => {
    mockSignup.mockRejectedValue(new Error('Email already registered'));
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/first name/i), 'Ada');
    await user.type(screen.getByLabelText(/last name/i), 'Lovelace');
    await user.type(screen.getByLabelText(/email/i), 'ada@computing.com');
    await user.type(screen.getByLabelText(/password/i), 'engineroom42');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await screen.findByRole('alert');
    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).not.toBeDisabled();
  });
});
