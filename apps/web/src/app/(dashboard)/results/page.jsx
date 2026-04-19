'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResultsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/report-cards'); }, [router]);
  return null;
}
