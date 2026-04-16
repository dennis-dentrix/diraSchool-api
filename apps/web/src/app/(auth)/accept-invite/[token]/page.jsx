'use client';

import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { authApi, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Only ask for password — the admin already captured the name during account creation.
// If the name needs updating, the user can do so from their profile after logging in.
const schema = z
  .object({
    password:        z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path:    ['confirmPassword'],
  });

export default function AcceptInvitePage() {
  const params = useParams();
  const token  = Array.isArray(params?.token) ? params.token[0] : params?.token;
  const router = useRouter();
  const { setUser } = useAuthStore();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: ({ confirmPassword, ...data }) => authApi.acceptInvite(token, data),
    onSuccess: (res) => {
      const user = res.data?.data?.user ?? res.data?.user ?? null;
      setUser(user);
      toast.success('Account activated! Welcome.');
      router.push('/dashboard');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Activate your account</CardTitle>
        <CardDescription>
          Your name has been set by your administrator. Create a password to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(mutate)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Create password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isPending || !token}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Activate account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
