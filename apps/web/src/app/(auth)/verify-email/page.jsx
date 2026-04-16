'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import { authApi, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const { setUser } = useAuthStore();

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const [resendCooldown, setResendCooldown] = useState(0);

  // countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const { mutate: verify, isPending } = useMutation({
    mutationFn: (code) => authApi.verifyEmail(email, code),
    onSuccess: (res) => {
      const user = res.data.data?.user;
      setUser(user);
      toast.success('Email verified! Welcome to Diraschool.');
      if (user?.role === 'parent') router.push('/portal');
      else if (user?.role === 'superadmin') router.push('/superadmin');
      else router.push('/dashboard');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: resend, isPending: resending } = useMutation({
    mutationFn: () => authApi.resendVerification(email),
    onSuccess: () => {
      toast.success('New code sent — check your inbox.');
      setResendCooldown(60);
      setDigits(['', '', '', '', '', '']);
      refs[0].current?.focus();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleDigit(index, value) {
    // allow paste of full code
    if (value.length === 6 && /^\d{6}$/.test(value)) {
      const arr = value.split('');
      setDigits(arr);
      refs[5].current?.focus();
      verify(value);
      return;
    }

    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);

    if (char && index < 5) refs[index + 1].current?.focus();

    // auto-submit when all filled
    if (next.every((d) => d !== '') && next.join('').length === 6) {
      verify(next.join(''));
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  }

  const code = digits.join('');
  const masked = email.replace(/(.{2}).+(@.+)/, '$1…$2');

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
      <CardHeader className="space-y-1 text-center pb-2">
        <div className="flex justify-center mb-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-50">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
        <CardDescription>
          We sent a 6-digit code to{' '}
          <span className="font-medium text-foreground">{masked || 'your email'}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-4">
        {/* OTP boxes */}
        <div className="flex justify-center gap-2.5">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              autoFocus={i === 0}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`
                w-11 h-14 text-center text-xl font-bold rounded-lg border-2 outline-none transition-all
                ${digit ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-input bg-background text-foreground'}
                focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
              `}
            />
          ))}
        </div>

        <Button
          className="w-full"
          onClick={() => code.length === 6 && verify(code)}
          disabled={isPending || code.length < 6}
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Verify email
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          Didn't receive the code?{' '}
          {resendCooldown > 0 ? (
            <span className="text-muted-foreground">Resend in {resendCooldown}s</span>
          ) : (
            <button
              onClick={() => resend()}
              disabled={resending}
              className="text-blue-600 hover:underline font-medium inline-flex items-center gap-1 disabled:opacity-50"
            >
              {resending && <Loader2 className="h-3 w-3 animate-spin" />}
              Resend code
            </button>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          The code expires in 30 minutes.{' '}
          <button
            onClick={() => router.push('/login')}
            className="hover:underline"
          >
            Back to sign in
          </button>
        </p>
      </CardContent>
    </Card>
  );
}
