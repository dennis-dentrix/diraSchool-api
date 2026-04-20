'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="p-8">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 rounded-md border px-3 py-2 text-sm"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
