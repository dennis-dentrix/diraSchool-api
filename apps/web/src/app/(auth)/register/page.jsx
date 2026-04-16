'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { authApi, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  schoolName: z.string().min(3, 'School name must be at least 3 characters'),
  schoolPhone: z.string().regex(/^(\+254|0|254)?[17]\d{8}$/, 'Invalid school phone (Kenyan format required)'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function RegisterPage() {
  const router = useRouter();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: ({ confirmPassword, ...data }) => authApi.register(data),
    onSuccess: (res) => {
      const email = res.data.data?.email;
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Register your school</CardTitle>
        <CardDescription>Start your free trial — no credit card required</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(mutate)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schoolName">School name</Label>
            <Input id="schoolName" placeholder="Nairobi Primary School" {...register('schoolName')} />
            {errors.schoolName && <p className="text-xs text-destructive">{errors.schoolName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="schoolPhone">School phone number</Label>
            <Input id="schoolPhone" type="tel" placeholder="0712 345 678" {...register('schoolPhone')} />
            {errors.schoolPhone && <p className="text-xs text-destructive">{errors.schoolPhone.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" placeholder="John" {...register('firstName')} />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" placeholder="Kamau" {...register('lastName')} />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" placeholder="principal@school.ac.ke" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone number (optional)</Label>
            <Input id="phone" type="tel" placeholder="0712 345 678" {...register('phone')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Min. 8 characters" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" type="password" placeholder="••••••••" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
        </div>
      </CardContent>
    </Card>
  );
}
