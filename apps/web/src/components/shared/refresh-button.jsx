'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RefreshButton({ queryKeys = [], variant = 'outline', size = 'sm' }) {
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);

  async function handleRefresh() {
    setSpinning(true);
    await Promise.all(
      queryKeys.map((key) => queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }))
    );
    setTimeout(() => setSpinning(false), 600);
  }

  return (
    <Button variant={variant} size={size} onClick={handleRefresh} title="Refresh">
      <RefreshCw className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />
    </Button>
  );
}
