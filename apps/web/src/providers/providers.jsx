'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { useState } from 'react';

export function Providers({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data stays "fresh" for 3 minutes — navigating between pages won't
            // re-fetch if the data was loaded less than 3 minutes ago.
            staleTime: 3 * 60 * 1000,
            // Keep unused data in memory for 10 minutes (survives navigation).
            gcTime: 10 * 60 * 1000,
            // Don't refetch just because the browser tab regains focus.
            // This was firing a full page re-fetch every time the user alt-tabbed.
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              const status = error?.response?.status;
              if (status === 401 || status === 403 || status === 404) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
