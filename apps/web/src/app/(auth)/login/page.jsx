'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import { authApi, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const nextPath     = searchParams.get('next') || '/dashboard';
  const { setUser }  = useAuthStore();
  const queryClient  = useQueryClient();
  const [showPassword,    setShowPassword]    = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url         = new URL(window.location.href);
    const allowedNext = url.searchParams.get('next');
    const unsafeParams = [...url.searchParams.keys()].some((k) => k !== 'next');
    if (!unsafeParams) return;
    const clean = new URL('/login', window.location.origin);
    if (allowedNext) clean.searchParams.set('next', allowedNext);
    window.history.replaceState(null, '', clean.toString());
  }, []);

  const { register, handleSubmit, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data) => authApi.login(data),
    onSuccess: (res) => {
      // The normalizer may or may not unwrap the payload depending on key count,
      // so read user and token explicitly from the top-level response fields.
      const user  = res.data.user  ?? res.data.data?.user;
      const token = res.data.token ?? res.data.data?.token;
      if (!user) {
        toast.error('Login failed: no user data received');
        return;
      }

      // Store token in localStorage (for API Authorization header) and as a
      // same-domain cookie (so Next.js middleware can read it for route guards)
      if (token && typeof window !== 'undefined') {
        localStorage.setItem('authToken', token);
        // Store expiry so the client can proactively logout without an API round-trip
        localStorage.setItem('authTokenExpiry', String(Date.now() + 20 * 60 * 60 * 1000));
        document.cookie = `token=${token}; path=/; max-age=${20 * 60 * 60}; SameSite=Lax`;
      }

      setUser(user);
      // Seed the cache with the correct user object so useAuth doesn't need
      // an extra round-trip before the dashboard query becomes enabled.
      queryClient.setQueryData(['auth', 'me'], user);
      if (user.role === 'parent') router.push('/portal');
      else if (user.role === 'superadmin') router.push('/superadmin');
      else router.push(nextPath);
    },
    onError: (err) => {
      const status  = err.response?.status;
      const message = getErrorMessage(err);
      if (status === 403 && message.toLowerCase().includes('verify')) {
        setUnverifiedEmail(getValues('email'));
      } else {
        toast.error(message);
      }
    },
  });

  if (unverifiedEmail) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
            <MailCheck className="h-6 w-6 text-foreground" />
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-bold tracking-tight">Verify your email first</h2>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-foreground">{unverifiedEmail}</span>
          </p>
        </div>
        <Button
          className="w-full h-10 bg-foreground text-background hover:bg-foreground/90"
          onClick={() => router.push(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`)}
        >
          Enter verification code
        </Button>
        <button
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          onClick={() => setUnverifiedEmail(null)}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <>
      {isPending && <div className="fixed inset-x-0 top-0 z-50 h-px bg-foreground" />}

      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-[32px] font-bold tracking-tight leading-none">Welcome back</h1>
          <p className="text-muted-foreground text-sm">Sign in to access your school dashboard</p>
        </div>

        <form onSubmit={handleSubmit(mutate)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@school.ac.ke"
              className="h-10"
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-bad">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-10 pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-bad">{errors.password.message}</p>}
          </div>

          <Button
            type="submit"
            className="w-full h-10 bg-foreground text-background hover:bg-foreground/90 mt-2"
            disabled={isPending}
          >
            Sign in
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          New school?{' '}
          <Link href="/register" className="font-medium text-foreground hover:underline underline-offset-2">
            Register here
          </Link>
        </p>
      </div>
    </>
  );
}
