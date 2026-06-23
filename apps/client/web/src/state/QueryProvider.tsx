'use client';

/**
 * Instantiates a TanStack QueryClient with project-default stale times and
 * wraps children in QueryClientProvider so all hooks have access to the cache.
 */
import { useState } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const DEFAULT_QUERY_RETRY = 1;
const DEFAULT_STALE_TIME_MS = 30_000;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: DEFAULT_STALE_TIME_MS,
            retry: DEFAULT_QUERY_RETRY,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
