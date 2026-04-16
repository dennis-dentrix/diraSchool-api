'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const statusBadge = {
  trial: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
};

const statusFill = { trial: '#f59e0b', active: '#22c55e', suspended: '#ef4444', expired: '#9ca3af' };

export default function SuperadminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => { const res = await adminApi.stats(); return res.data.data; },
  });

  const { data: recentData, isLoading: schoolsLoading } = useQuery({
    queryKey: ['admin-schools-recent'],
    queryFn: async () => { const res = await adminApi.listSchools({ limit: 8, page: 1 }); return res.data; },
  });

  const byStatus = stats?.schools?.byStatus ?? {};
  const total = stats?.schools?.total ?? 0;
  const recent = stats?.schools?.recentSignups ?? 0;
  const active = byStatus.active ?? 0;
  const trial = byStatus.trial ?? 0;
  const statusChartData = Object.entries(byStatus).map(([status, count]) => ({ status, count }));
  const topCounties = stats?.topCounties ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Overview" description="All schools and users on Diraschool" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Schools" value={isLoading ? '—' : total} icon={Building2} color="blue" />
        <StatCard title="Active" value={isLoading ? '—' : active} icon={CheckCircle} color="green" />
        <StatCard title="On Trial" value={isLoading ? '—' : trial} icon={Clock} color="yellow" />
        <StatCard title="New (30 days)" value={isLoading ? '—' : recent} icon={TrendingUp} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Schools by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusChartData} barSize={44}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Schools">
                  {statusChartData.map((entry) => (
                    <Cell key={entry.status} fill={statusFill[entry.status] ?? '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top Counties</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : topCounties.length ? (
              <div className="space-y-3 pt-1">
                {topCounties.map((c, i) => (
                  <div key={c.county} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium capitalize">{c.county}</span>
                        <span className="text-muted-foreground">{c.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${Math.round((c.count / (topCounties[0]?.count || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No county data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Recently Registered Schools</CardTitle></CardHeader>
        <CardContent>
          {schoolsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (recentData?.schools ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No schools registered yet</p>
          ) : (
            <div className="divide-y">
              {(recentData?.schools ?? []).map((school) => (
                <div key={school._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{school.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {school.county ? `${school.county} · ` : ''}{formatDate(school.createdAt)}
                      {school.staffCount ? ` · ${school.staffCount} staff` : ''}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${statusBadge[school.subscriptionStatus] ?? 'bg-gray-100 text-gray-800'}`}>
                    {school.subscriptionStatus ?? 'trial'}
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
