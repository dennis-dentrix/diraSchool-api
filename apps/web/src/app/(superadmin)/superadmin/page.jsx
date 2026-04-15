'use client';

import { useQuery } from '@tanstack/react-query';
import { schoolsApi, usersApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, CreditCard, TrendingUp, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const planColors = {
  trial: 'bg-yellow-100 text-yellow-800',
  basic: 'bg-blue-100 text-blue-800',
  standard: 'bg-purple-100 text-purple-800',
  premium: 'bg-green-100 text-green-800',
};

export default function SuperadminDashboardPage() {
  const { data: schoolsData, isLoading: schoolsLoading } = useQuery({
    queryKey: ['sa-schools'],
    queryFn: async () => {
      const res = await schoolsApi.list({ limit: 200 });
      return res.data;
    },
  });

  const schools = schoolsData?.data ?? [];
  const total = schools.length;
  const active = schools.filter((s) => s.subscription?.status === 'active').length;
  const trial = schools.filter((s) => s.subscription?.planTier === 'trial').length;
  const expiringSoon = schools.filter((s) => {
    if (!s.subscription?.trialExpiry) return false;
    const days = (new Date(s.subscription.trialExpiry) - new Date()) / 86400000;
    return days >= 0 && days <= 7;
  }).length;

  // Plan breakdown for bar chart
  const planBreakdown = ['trial', 'basic', 'standard', 'premium'].map((plan) => ({
    plan,
    count: schools.filter((s) => s.subscription?.planTier === plan).length,
  }));

  // Recent registrations (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const month = d.toLocaleString('default', { month: 'short' });
    const count = schools.filter((s) => {
      const created = new Date(s.createdAt);
      return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
    }).length;
    return { month, count };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="System Overview" description="Platform-wide metrics for Diraschool" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Schools" value={schoolsLoading ? '—' : total} icon={Building2} color="blue" />
        <StatCard title="Active" value={schoolsLoading ? '—' : active} icon={CheckCircle} color="green" />
        <StatCard title="On Trial" value={schoolsLoading ? '—' : trial} icon={Clock} color="yellow" />
        <StatCard title="Expiring Soon" value={schoolsLoading ? '—' : expiringSoon} icon={AlertTriangle} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">New Schools (6 months)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="saGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="url(#saGrad)" name="Schools" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Schools by Plan</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={planBreakdown}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="plan" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Schools" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Recently Registered Schools</CardTitle></CardHeader>
        <CardContent>
          {schoolsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="divide-y">
              {schools
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 8)
                .map((school) => (
                  <div key={school._id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{school.name}</p>
                      <p className="text-xs text-muted-foreground">{school.email ?? '—'} · {formatDate(school.createdAt)}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${planColors[school.subscription?.planTier] ?? 'bg-gray-100 text-gray-800'}`}>
                      {school.subscription?.planTier ?? 'trial'}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
