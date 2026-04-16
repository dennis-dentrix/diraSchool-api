'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VerifyEmailPage({ params }) {
  const { token } = params;
  const router = useRouter();
  const { setUser } = useAuthStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['verify-email', token],
    queryFn: async () => {
      const res = await authApi.verifyEmailByToken(token);
      return res.data.data;
    },
    retry: false,
  });

  useEffect(() => {
    if (data) {
      setUser(data);
      setTimeout(() => router.push('/dashboard'), 2000);
    }
  }, [data, router, setUser]);

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur text-center">
      <CardContent className="pt-8 pb-6 space-y-4">
        {isLoading && (
          <>
            <Loader2 className="h-12 w-12 text-blue-500 mx-auto animate-spin" />
            <p className="font-medium">Verifying your email…</p>
          </>
        )}
        {data && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Email verified!</h2>
            <p className="text-muted-foreground text-sm">Redirecting you to the dashboard…</p>
          </>
        )}
        {isError && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Verification failed</h2>
            <p className="text-muted-foreground text-sm">
              This link may have expired or already been used.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full mt-2">Back to sign in</Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
