import { act } from 'react';

import { AuthProvider, useAuth } from '@/state/AuthContext';
import { QueryProvider } from '@/state/QueryProvider';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@/api/request', () => ({
  get: mockGet,
  post: mockPost,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  );
}

describe('useAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within AuthProvider',
    );
  });

  it('exposes the current user once /auth/me resolves', async () => {
    mockGet.mockResolvedValue({
      user: {
        id: 'u1',
        email: 'a@b.co',
        first_name: 'A',
        last_name: 'B',
        created_at: 't',
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user?.email).toBe('a@b.co');
  });

  it('treats a 401 from /auth/me as a signed-out null user', async () => {
    const { ApiError } = await import('@/errors/ApiError');
    mockGet.mockRejectedValue(new ApiError(401, 'unauthorized'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('login posts credentials and populates the user', async () => {
    mockGet.mockRejectedValue(
      new (await import('@/errors/ApiError')).ApiError(401, 'unauthorized'),
    );
    mockPost.mockResolvedValue({
      user: {
        id: 'u2',
        email: 'c@d.co',
        first_name: 'C',
        last_name: 'D',
        created_at: 't',
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('c@d.co', 'pw');
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/login', {
      email: 'c@d.co',
      password: 'pw',
    });
    await waitFor(() => expect(result.current.user?.email).toBe('c@d.co'));
  });

  it('logout calls post /auth/logout and redirects to /login', async () => {
    mockGet.mockResolvedValue({
      user: {
        id: 'u3',
        email: 'e@f.co',
        first_name: 'E',
        last_name: 'F',
        created_at: 't',
      },
    });
    mockPost.mockResolvedValue(undefined);

    // jsdom does not allow direct assignment to window.location.href, so
    // replace the whole location object with a writable stub for this test.
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/logout');
    expect(window.location.href).toBe('/login');

    // Restore the real location object so other tests are unaffected.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
