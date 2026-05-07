'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { authApi, getErrorMessage } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const kenyaPhoneRegex = /^(\+254|0|254)?[17]\d{8}$/;

const schema = z.object({
  schoolName:  z.string().min(3, 'School name must be at least 3 characters'),
  schoolPhone: z.string().trim().regex(kenyaPhoneRegex, 'Invalid school phone (Kenyan format required)'),
  firstName:   z.string().min(1, 'First name is required'),
  lastName:    z.string().min(1, 'Last name is required'),
  email:       z.string().email('Enter a valid email'),
  phone:       z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().regex(kenyaPhoneRegex, 'Invalid phone number (Kenyan format required)').optional(),
  ),
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function RegisterPage() {
  const router        = useRouter();
  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: ({ confirmPassword, ...data }) => authApi.register(data),
    onSuccess: (res) => {
      const email = res.data.data?.email ?? res.data.email;
      if (!email) {
        toast.error('Registration succeeded, but we could not read your email from the server response.');
        return;
      }
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <>
      {isPending && <div className="fixed inset-x-0 top-0 z-50 h-px bg-foreground" />}

      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-[32px] font-bold tracking-tight leading-none">Register your school</h1>
          <p className="text-muted-foreground text-sm">Start your free trial — no credit card required</p>
        </div>

        <form onSubmit={handleSubmit(mutate)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="schoolName">School name</Label>
            <Input id="schoolName" className="h-10" placeholder="Nairobi Primary School" {...register('schoolName')} />
            {errors.schoolName && <p className="text-xs text-bad">{errors.schoolName.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="schoolPhone">School phone number</Label>
            <Input id="schoolPhone" type="tel" className="h-10" placeholder="0712 345 678" {...register('schoolPhone')} />
            {errors.schoolPhone && <p className="text-xs text-bad">{errors.schoolPhone.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" className="h-10" placeholder="John" {...register('firstName')} />
              {errors.firstName && <p className="text-xs text-bad">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" className="h-10" placeholder="Doe" {...register('lastName')} />
              {errors.lastName && <p className="text-xs text-bad">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" className="h-10" placeholder="principal@school.ac.ke" {...register('email')} />
            {errors.email && <p className="text-xs text-bad">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="phone" type="tel" className="h-10" placeholder="0712 345 678" {...register('phone')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input id="password" type={showPwd ? 'text' : 'password'} className="h-10 pr-10" placeholder="Min. 8 characters" {...register('password')} />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-bad">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative">
              <Input id="confirmPassword" type={showConfirm ? 'text' : 'password'} className="h-10 pr-10" placeholder="••••••••" {...register('confirmPassword')} />
              <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-bad">{errors.confirmPassword.message}</p>}
          </div>

          <Button
            type="submit"
            className="w-full h-10 bg-foreground text-background hover:bg-foreground/90 mt-2"
            disabled={isPending}
          >
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-foreground hover:underline underline-offset-2">Sign in</Link>
        </p>
      </div>
    </>
  );
}
