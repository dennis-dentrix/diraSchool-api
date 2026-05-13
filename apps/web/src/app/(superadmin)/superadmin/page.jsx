'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Building2, CheckCircle, Clock, TrendingUp, Users, UserCheck,
  GraduationCap, LayoutGrid, Activity, LogIn, ChevronUp, ChevronDown,
  ChevronsUpDown, Wallet, Receipt, MessageSquare, AlertTriangle,
  ArrowRight, Ban,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => `KES ${Math.round(n ?? 0).toLocaleString('en-KE')}`;

const statusBadge = {
  trial:     'bg-yellow-100 text-yellow-800',
  active:    'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
  expired:   'bg-gray-100 text-gray-800',
};

const statusFill = { trial: '#f59e0b', active: '#22c55e', suspended: '#ef4444', expired: '#9ca3af' };

const ROLE_LABELS = {
  school_admin:       'School Admin',
  director:           'Director',
  headteacher:        'Head Teacher',
  deputy_headteacher: 'Deputy Head',
  secretary:          'Secretary',
  accountant:         'Accountant',
  teacher:            'Teacher',
  department_head:    'Dept Head',
  parent:             'Parent',
};

const SORT_KEYS = ['name', 'staffCount', 'studentCount', 'classCount', 'subscriptionStatus'];

// ─── Sort icon ────────────────────────────────────────────────────────────────
function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />;
  return dir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-foreground" />
    : <ChevronDown className="h-3 w-3 text-foreground" />;
}

// ─── School breakdown table ───────────────────────────────────────────────────
function SchoolBreakdownTable({ schools, loading }) {
  const [sortKey, setSortKey] = useState('studentCount');
  const [sortDir, setSortDir] = useState('desc');
  const [expanded, setExpanded] = useState(null);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...schools].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const Th = ({ label, k }) => (
    <th
      className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap"
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === k} dir={sortDir} />
      </span>
    </th>
  );

  if (loading) {
    return (
      <div className="space-y-2 pt-1 p-4">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/30">
          <tr>
            <Th label="School"   k="name" />
            <Th label="Status"   k="subscriptionStatus" />
            <Th label="Staff"    k="staffCount" />
            <Th label="Students" k="studentCount" />
            <Th label="Classes"  k="classCount" />
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Top roles</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((school) => {
            const roles = school.usersByRole ?? {};
            const topRoles = Object.entries(roles).sort((a, b) => b[1] - a[1]).slice(0, 3);
            const isOpen = expanded === school._id;

            return (
              <>
                <tr
                  key={school._id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : school._id)}
                >
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-sm truncate max-w-[200px]">{school.name}</p>
                    <p className="text-[11px] text-muted-foreground">{school.county ?? '—'}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium capitalize', statusBadge[school.subscriptionStatus] ?? 'bg-gray-100 text-gray-800')}>
                      {school.subscriptionStatus ?? 'trial'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums font-medium text-center">{school.staffCount ?? 0}</td>
                  <td className="px-3 py-2.5 tabular-nums font-medium text-center">{school.studentCount ?? 0}</td>
                  <td className="px-3 py-2.5 tabular-nums font-medium text-center">{school.classCount ?? 0}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {topRoles.map(([role, count]) => (
                        <span key={role} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                          {ROLE_LABELS[role] ?? role}: {count}
                        </span>
                      ))}
                      {topRoles.length === 0 && <span className="text-[11px] text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(school.createdAt)}
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${school._id}-detail`} className="bg-muted/20">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {Object.entries(roles).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
                          <div key={role} className="flex items-center justify-between bg-background border rounded-md px-3 py-2">
                            <span className="text-xs text-muted-foreground capitalize">{ROLE_LABELS[role] ?? role.replace(/_/g, ' ')}</span>
                            <span className="text-sm font-semibold">{count}</span>
                          </div>
                        ))}
                        {Object.keys(roles).length === 0 && (
                          <p className="text-xs text-muted-foreground col-span-full">No users registered yet.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No schools registered yet.</p>
      )}
    </div>
  );
}

// ─── Recent payments table ────────────────────────────────────────────────────
function RecentPaymentsTable({ payments, loading }) {
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtCycle = (c) => ({ 'per-term': 'Per Term', annual: 'Annual', 'multi-year': '3-Year' }[c] ?? c);

  if (loading) return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
    </div>
  );

  if (!payments?.length) return (
    <p className="text-sm text-muted-foreground text-center py-8">No payments recorded yet.</p>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/30">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">School</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Amount</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Cycle</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {payments.map((p) => (
            <tr key={p._id} className="hover:bg-muted/20 transition-colors">
              <td className="px-3 py-2.5">
                <p className="font-medium truncate max-w-[180px]">{p.schoolId?.name ?? '—'}</p>
                <p className="text-[11px] text-muted-foreground">{p.schoolId?.county ?? ''}</p>
              </td>
              <td className="px-3 py-2.5 font-mono font-semibold text-sm">{fmt(p.amount)}</td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmtCycle(p.billingCycle)}</td>
              <td className="px-3 py-2.5">
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium capitalize',
                  p.status === 'completed' ? 'bg-green-100 text-green-700'
                    : p.status === 'pending' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                )}>
                  {p.status}
                </span>
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                {fmtDate(p.paidAt ?? p.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── SMS summary row ──────────────────────────────────────────────────────────
function SmsSummaryRow({ schools }) {
  if (!schools?.length) return null;
  const total = schools.reduce((s, r) => s + (r.total ?? 0), 0);
  const delivered = schools.reduce((s, r) => s + (r.delivered ?? 0), 0);
  const failed = schools.reduce((s, r) => s + (r.failed ?? 0), 0);
  const rate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
      {[
        { label: 'Total SMS sent', value: total.toLocaleString() },
        { label: 'Delivered', value: delivered.toLocaleString(), color: 'text-green-600' },
        { label: 'Failed', value: failed.toLocaleString(), color: 'text-red-500' },
        { label: 'Delivery rate', value: `${rate}%`, color: rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-yellow-600' : 'text-red-500' },
      ].map((item) => (
        <div key={item.label} className="rounded-lg bg-muted/40 px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
          <p className={cn('text-lg font-bold tabular-nums', item.color ?? 'text-foreground')}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SuperadminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => { const res = await adminApi.stats(); return res.data.data; },
  });

  const { data: schoolsData, isLoading: schoolsLoading } = useQuery({
    queryKey: ['admin-schools-all'],
    queryFn: async () => { const res = await adminApi.listSchools({ limit: 200, page: 1 }); return res.data; },
  });

  const { data: financeData, isLoading: financeLoading } = useQuery({
    queryKey: ['admin-finance-summary'],
    queryFn: async () => { const res = await adminApi.financeSummary(); return res.data?.data ?? res.data; },
    staleTime: 60_000,
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['admin-recent-payments'],
    queryFn: async () => {
      const res = await adminApi.financePayments({ limit: 8, status: 'completed' });
      return res.data?.data?.payments ?? res.data?.payments ?? [];
    },
    staleTime: 60_000,
  });

  const { data: smsData, isLoading: smsLoading } = useQuery({
    queryKey: ['admin-sms-analytics'],
    queryFn: async () => {
      const res = await adminApi.smsAnalytics();
      return res.data?.data?.schools ?? res.data?.schools ?? [];
    },
    staleTime: 120_000,
  });

  const allSchools     = schoolsData?.schools ?? schoolsData?.data ?? [];
  const byStatus       = stats?.schools?.byStatus ?? {};
  const total          = stats?.schools?.total ?? 0;
  const recent         = stats?.schools?.recentSignups ?? 0;
  const active         = byStatus.active ?? 0;
  const trial          = byStatus.trial ?? 0;
  const suspended      = byStatus.suspended ?? 0;
  const expired        = byStatus.expired ?? 0;
  const statusChartData = Object.entries(byStatus).map(([status, count]) => ({ status, count }));
  const topCounties    = stats?.topCounties ?? [];

  const byRole     = stats?.users?.byRole ?? {};
  const totalUsers = Object.values(byRole).reduce((s, n) => s + n, 0);
  const roleRows   = Object.entries(byRole).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxRoleCount = roleRows[0]?.[1] ?? 1;

  const totalStudents  = stats?.students?.total ?? 0;
  const totalClasses   = stats?.classes?.total ?? 0;
  const auditActions7d = stats?.activity?.auditActions7d ?? 0;
  const logins24h      = stats?.activity?.logins24h ?? 0;

  const revenue        = financeData?.summary?.revenue ?? 0;
  const net            = financeData?.summary?.net ?? 0;
  const expenses       = financeData?.summary?.expenses ?? 0;
  const pendingRevenue = financeData?.summary?.pendingRevenue ?? 0;

  const hasAlerts = suspended > 0 || expired > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Overview" description="All schools, users, and revenue on Diraschool" />

      {/* Alerts */}
      {!isLoading && hasAlerts && (
        <div className="flex flex-wrap gap-3">
          {suspended > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <Ban className="h-4 w-4 shrink-0" />
              <span><strong>{suspended}</strong> school{suspended > 1 ? 's' : ''} suspended</span>
              <Link href="/superadmin/schools?status=suspended" className="underline text-xs ml-1">View →</Link>
            </div>
          )}
          {expired > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span><strong>{expired}</strong> school{expired > 1 ? 's' : ''} expired</span>
              <Link href="/superadmin/schools?status=expired" className="underline text-xs ml-1">View →</Link>
            </div>
          )}
        </div>
      )}

      {/* School KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Schools"  value={isLoading ? '—' : total}  icon={Building2}   color="blue" />
        <StatCard title="Active Schools" value={isLoading ? '—' : active} icon={CheckCircle} color="green" />
        <StatCard title="On Trial"       value={isLoading ? '—' : trial}  icon={Clock}       color="yellow" />
        <StatCard title="New (30 days)"  value={isLoading ? '—' : recent} icon={TrendingUp}  color="orange" />
      </div>

      {/* Finance KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={financeLoading ? '—' : fmt(revenue)}
          icon={Wallet}
          color="green"
        />
        <StatCard
          title="Pending Revenue"
          value={financeLoading ? '—' : fmt(pendingRevenue)}
          icon={Receipt}
          color="yellow"
        />
        <StatCard
          title="Total Expenses"
          value={financeLoading ? '—' : fmt(expenses)}
          icon={Receipt}
          color="red"
        />
        <StatCard
          title="Net Income"
          value={financeLoading ? '—' : fmt(net)}
          icon={TrendingUp}
          color={net >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* User + content KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users"    value={isLoading ? '—' : totalUsers}          icon={Users}         color="purple" />
        <StatCard title="Total Students" value={isLoading ? '—' : totalStudents}       icon={GraduationCap} color="blue" />
        <StatCard title="Total Classes"  value={isLoading ? '—' : totalClasses}        icon={LayoutGrid}    color="green" />
        <StatCard title="Logins (24h)"   value={isLoading ? '—' : logins24h}           icon={LogIn}         color="orange" />
      </div>

      {/* Charts row */}
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
              <div className="space-y-3 pt-1">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
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
                        <div className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${Math.round((c.count / (topCounties[0]?.count || 1)) * 100)}%` }} />
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

      {/* Users by role + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">Users by Role (platform-wide)</CardTitle>
            <Link href="/superadmin/users" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3 pt-1">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
            ) : roleRows.length ? (
              <div className="space-y-2.5 pt-1">
                {roleRows.map(([role, count]) => (
                  <div key={role} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-[110px] shrink-0 capitalize">
                      {ROLE_LABELS[role] ?? role.replace(/_/g, ' ')}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${Math.round((count / maxRoleCount) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No users yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              SMS Analytics (this term)
            </CardTitle>
            <Link href="/superadmin/sms" className="text-xs text-blue-600 hover:underline">Details →</Link>
          </CardHeader>
          <CardContent>
            {smsLoading ? (
              <div className="space-y-3 pt-1">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : smsData?.length ? (
              <SmsSummaryRow schools={smsData} />
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No SMS sent this term yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent subscription payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold">Recent Subscription Payments</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Last 8 completed payments across all schools.</p>
          </div>
          <Link href="/superadmin/finance" className="text-xs text-blue-600 hover:underline shrink-0 flex items-center gap-1">
            Finance <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <RecentPaymentsTable payments={paymentsData} loading={paymentsLoading} />
        </CardContent>
      </Card>

      {/* Per-school breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold">School Breakdown</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Users, students and classes per school. Click a row to expand role breakdown.</p>
          </div>
          <Link href="/superadmin/schools" className="text-xs text-blue-600 hover:underline shrink-0">View all →</Link>
        </CardHeader>
        <CardContent className="p-0">
          <SchoolBreakdownTable schools={allSchools} loading={schoolsLoading} />
        </CardContent>
      </Card>

      {/* Activity + margin summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Platform Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Audit actions (7 days)',  value: auditActions7d, icon: Activity },
              { label: 'Logins (24 hours)',        value: logins24h,       icon: LogIn },
              { label: 'Teaching staff',           value: (byRole.teacher ?? 0) + (byRole.department_head ?? 0), icon: UserCheck },
              { label: 'School admins',            value: byRole.school_admin ?? 0, icon: UserCheck },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
                <span className="text-sm font-semibold tabular-nums">{isLoading ? '—' : value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">Finance Summary</CardTitle>
            <Link href="/superadmin/finance" className="text-xs text-blue-600 hover:underline">Full report →</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Total revenue',     value: fmt(revenue),        color: 'text-green-600' },
              { label: 'Total expenses',    value: fmt(expenses),       color: 'text-red-500' },
              { label: 'Net income',        value: fmt(net),            color: net >= 0 ? 'text-green-600' : 'text-red-500' },
              { label: 'Pending payments',  value: fmt(pendingRevenue), color: 'text-yellow-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className={cn('text-sm font-semibold font-mono tabular-nums', color)}>
                  {financeLoading ? '—' : value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
