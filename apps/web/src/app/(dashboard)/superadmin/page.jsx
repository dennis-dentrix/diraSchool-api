'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function SuperadminOverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => { const res = await adminApi.stats(); return res.data; },
  });

  const stats = data?.stats ?? data;

  const cards = [
    { label: 'Total Schools', value: stats?.totalSchools, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Schools', value: stats?.activeSchools, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'On Trial', value: stats?.trialSchools, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Total Users', value: stats?.totalUsers, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Superadmin Overview" description="Platform-wide stats and management">
        <Button asChild size="sm"><Link href="/superadmin/schools">Manage Schools</Link></Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                {isLoading ? <Skeleton className="h-6 w-12 rounded-full mb-1" /> : <p className="text-2xl font-bold">{value ?? '—'}</p>}
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
