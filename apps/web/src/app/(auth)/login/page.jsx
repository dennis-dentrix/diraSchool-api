'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, MailCheck } from 'lucide-react';
import { authApi, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/dashboard';
  const { setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);

  const { register, handleSubmit, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data) => authApi.login(data),
    onSuccess: (res) => {
      const user = res.data.data?.user;
      setUser(user);
      queryClient.setQueryData(['auth', 'me'], user);
      if (user.role === 'parent') router.push('/portal');
      else if (user.role === 'superadmin') router.push('/superadmin');
      else router.push(nextPath);
    },
    onError: (err) => {
      const status = err.response?.status;
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
      <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
        <CardContent className="pt-10 pb-8 text-center space-y-5">
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-50">
              <MailCheck className="h-7 w-7 text-blue-600" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold">Verify your email first</h2>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to<br />
              <span className="font-medium text-foreground">{unverifiedEmail}</span>
            </p>
          </div>
          <Button
            className="w-full"
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
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-white/10 shadow-2xl bg-white/[0.07] backdrop-blur-xl text-white">
      <CardHeader className="space-y-1 pb-5">
        <CardTitle className="text-2xl font-bold text-white">Welcome back</CardTitle>
        <CardDescription className="text-slate-400">Sign in to access your school dashboard</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(mutate)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-300 text-xs font-medium uppercase tracking-wide">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@school.ac.ke"
              className="bg-white/10 border-white/15 text-white placeholder:text-slate-500 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/60 h-11"
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-300 text-xs font-medium uppercase tracking-wide">Password</Label>
              <Link href="/forgot-password" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="bg-white/10 border-white/15 text-white placeholder:text-slate-500 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/60 h-11 pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all duration-200 border-0 mt-2"
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Sign in
          </Button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-500">
          New school?{' '}
          <Link href="/register" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">Register here</Link>
        </div>
      </CardContent>
    </Card>
  );
}
