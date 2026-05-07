'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';

export default function VerifyEmailTokenPage() {
  const params       = useParams();
  const token        = Array.isArray(params?.token) ? params.token[0] : params?.token;
  const router       = useRouter();
  const { setUser }  = useAuthStore();
  const tokenTail    = token ? token.slice(-8) : '';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['verify-email', token],
    queryFn: async () => {
      const res = await authApi.verifyEmailByToken(token);
      return res.data.data?.user ?? res.data.user ?? null;
    },
    enabled: !!token,
    retry:   false,
  });

  useEffect(() => {
    if (data) {
      setUser(data);
      setTimeout(() => router.push('/dashboard'), 2000);
    }
  }, [data, router, setUser]);

  return (
    <div className="rounded-lg border bg-card p-8 space-y-5 text-center">
      {isLoading && (
        <>
          <Loader2 className="h-10 w-10 mx-auto animate-spin text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-semibold">Verifying your email…</p>
            <p className="text-xs font-mono text-muted-foreground">token: …{tokenTail}</p>
          </div>
        </>
      )}

      {data && (
        <>
          <CheckCircle2 className="h-10 w-10 mx-auto text-ok" />
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold">Email verified!</h2>
            <p className="text-sm text-muted-foreground">Redirecting you to the dashboard…</p>
          </div>
        </>
      )}

      {isError && (
        <>
          <XCircle className="h-10 w-10 mx-auto text-bad" />
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold">Verification failed</h2>
            <p className="text-sm text-muted-foreground">
              This link may have expired or already been used.
            </p>
            <p className="text-xs font-mono text-muted-foreground/60 pt-1">token: …{tokenTail}</p>
          </div>
          <Link href="/login">
            <Button className="w-full h-10 bg-foreground text-background hover:bg-foreground/90">
              Back to sign in
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
