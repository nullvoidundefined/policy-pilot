'use client';

/**
 * Auth guard layout for all protected routes: redirects unauthenticated users
 * to /login and renders a loading state while the auth check resolves.
 */
import { useEffect } from 'react';

import { useAuth } from '@/state/AuthContext';
import { useRouter } from 'next/navigation';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '12px',
        }}
      >
        <p>Preparing for takeoff...</p>
      </div>
    );
  }

  return <>{children}</>;
}
