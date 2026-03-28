'use client';

import { useEffect } from 'react';

import { useAuth } from '@/context/AuthContext';
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
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
