'use client';

import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Users, CreditCard, ClipboardList, AlertTriangle, UserX } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { dashboardApi, feesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';

const ADMIN_ROLES = ['school_admin', 'director', 'headteacher', 'deputy_headteacher'];
const FINANCE_ROLES = [...ADMIN_ROLES, 'accountant', 'secretary'];

const weeklyAttendance = [
  { day: 'Mon', present: 92, absent: 8 },
  { day: 'Tue', present: 88, absent: 12 },
  { day: 'Wed', present: 95, absent: 5 },
  { day: 'Thu', present: 90, absent: 10 },
  { day: 'Fri', present: 85, absent: 15 },
];

function TrialBanner({ daysLeft }) {
  if (daysLeft === null) return null;
  const urgent = daysLeft <= 3;
  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium border ${urgent ? 'bg-red-50 text-red-800 border-red-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        {daysLeft === 0
          ? 'Your trial has expired. Contact support to keep access.'
          : `Trial expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Upgrade to continue without interruption.`}
      </span>
    </div>
  );
}

function PendingStaffBanner({ count }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium bg-blue-50 text-blue-800 border border-blue-200">
      <UserX className="h-4 w-4 shrink-0" />
      <span>{count} staff member{count > 1 ? 's have' : ' has'} not yet set up their account.</span>
      <Link href="/staff" className="ml-auto underline underline-offset-2 text-blue-700 hover:text-blue-900 whitespace-nowrap">
        View staff →
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const isFinance = FINANCE_ROLES.includes(user?.role);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => { const res = await dashboardApi.get(); return res.data.data; },
    enabled: isAdmin,
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', 'recent'],
    queryFn: async () => { const res = await feesApi.listPayments({ limit: 6 }); return res.data; },
    enabled: isFinance,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const feeChartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const month = d.toLocaleString('default', { month: 'short' });
    const total = (paymentsData?.data ?? [])
      .filter((p) => { const pd = new Date(p.createdAt); return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear(); })
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    return { month, collected: total };
  });

  const trialDaysLeft = summary?.school?.trialDaysLeft ?? null;
  const pendingStaff = summary?.alerts?.staffAwaitingFirstLogin ?? 0;
  const termCollections = (paymentsData?.data ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">{greeting}, {user?.firstName}</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Here's what's happening at {summary?.school?.name ?? 'your school'} today.
        </p>
      </div>

      {isAdmin && !summaryLoading && (
        <div className="space-y-2">
          <TrialBanner daysLeft={trialDaysLeft} />
          <PendingStaffBanner count={pendingStaff} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={summaryLoading ? '—' : (summary?.students?.total ?? '—')}
          description={summary ? `${summary.students?.byStatus?.active ?? 0} active` : ''}
          icon={GraduationCap} color="blue" loading={summaryLoading && isAdmin}
        />
        {isAdmin && (
          <StatCard
            title="Staff Members"
            value={summaryLoading ? '—' : (summary?.staff?.total ?? '—')}
            description="All roles"
            icon={Users} color="purple" loading={summaryLoading}
          />
        )}
        {isFinance && (
          <StatCard
            title="Recent Collections"
            value={paymentsLoading ? '—' : formatCurrency(termCollections)}
            description="Last 6 months"
            icon={CreditCard} color="green" loading={paymentsLoading}
          />
        )}
        <StatCard title="Attendance" value="91%" description="This week" icon={ClipboardList} color="orange" trend={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isFinance && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Fee Collections</CardTitle>
              <CardDescription>Last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={feeChartData}>
                  <defs>
                    <linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="collected" stroke="#3b82f6" fill="url(#feeGrad)" strokeWidth={2} name="Collected" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Weekly Attendance</CardTitle>
            <CardDescription>Present vs absent this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyAttendance} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="present" fill="#22c55e" radius={[4, 4, 0, 0]} name="Present" />
                <Bar dataKey="absent" fill="#f87171" radius={[4, 4, 0, 0]} name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isAdmin && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Staff by Role</CardTitle></CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
              ) : Object.keys(summary?.staff?.byRole ?? {}).length ? (
                <div className="divide-y">
                  {Object.entries(summary.staff.byRole).map(([role, count]) => (
                    <div key={role} className="flex justify-between items-center py-2.5">
                      <span className="text-sm capitalize text-muted-foreground">{role.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-semibold tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No staff data</p>
              )}
            </CardContent>
          </Card>
        )}

        {isFinance && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Recent Payments</CardTitle></CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : paymentsData?.data?.length ? (
                <div className="divide-y">
                  {paymentsData.data.map((p) => (
                    <div key={p._id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium">{p.studentId?.firstName ?? 'Student'} {p.studentId?.lastName ?? ''}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)} · {p.method?.toUpperCase()}</p>
                      </div>
                      <span className="text-sm font-semibold text-green-600">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">No payments recorded yet</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
