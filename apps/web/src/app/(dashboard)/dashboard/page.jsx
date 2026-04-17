'use client';

import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap, Users, CreditCard, ClipboardList,
  AlertTriangle, UserX, BookOpen, BookMarked, ChevronRight,
  Plus, FileText, CalendarCheck,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { dashboardApi, feesApi, classesApi, subjectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';

const ADMIN_ROLES   = ['school_admin', 'director', 'headteacher', 'deputy_headteacher'];
const FINANCE_ROLES = [...ADMIN_ROLES, 'accountant', 'secretary'];

function QuickActions({ isAdmin: admin, isFinance: finance }) {
  const router = useRouter();
  const actions = [
    { label: 'Take Attendance', icon: CalendarCheck, href: '/attendance', show: true, color: 'text-green-600 bg-green-50 border-green-200' },
    { label: 'Enroll Student',  icon: Plus,          href: '/students',   show: admin, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { label: 'Record Payment',  icon: CreditCard,    href: '/fees/payments', show: finance, color: 'text-purple-600 bg-purple-50 border-purple-200' },
    { label: 'Report Cards',    icon: FileText,      href: '/report-cards',  show: admin,   color: 'text-orange-600 bg-orange-50 border-orange-200' },
  ].filter((a) => a.show);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {actions.map((a) => (
        <button
          key={a.href}
          onClick={() => router.push(a.href)}
          className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-sm font-medium transition-all hover:shadow-sm active:scale-95 ${a.color}`}
        >
          <a.icon className="h-5 w-5" />
          {a.label}
        </button>
      ))}
    </div>
  );
}

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

// ── Teacher Dashboard ──────────────────────────────────────────────────────────
function TeacherDashboard({ user }) {
  const { data: myClassData, isLoading: classLoading } = useQuery({
    queryKey: ['my-class'],
    queryFn: async () => { const res = await classesApi.myClass(); return res.data; },
  });

  const { data: mySubjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ['my-subjects'],
    queryFn: async () => { const res = await subjectsApi.mySubjects(); return res.data; },
  });

  const myClass    = myClassData?.data ?? myClassData;
  const mySubjects = mySubjectsData?.data ?? mySubjectsData ?? [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">{greeting}, {user?.firstName}</h2>
        <p className="text-muted-foreground text-sm mt-0.5">Here's your teaching overview for today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* My Class card */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" /> My Class
            </CardTitle>
          </CardHeader>
          <CardContent>
            {classLoading ? (
              <Skeleton className="h-16" />
            ) : myClass ? (
              <div>
                <p className="text-xl font-bold">{myClass.name}{myClass.stream ? ` ${myClass.stream}` : ''}</p>
                <p className="text-sm text-muted-foreground">{myClass.levelCategory}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>{myClass.studentCount ?? 0} students</span>
                  </div>
                  <Link href="/classes" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                    View <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{myClass.term} · {myClass.academicYear}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">No class assigned yet</p>
                <p className="text-xs text-muted-foreground mt-1">Contact admin to be assigned a class</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Subjects card */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-purple-600" /> My Subjects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subjectsLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
            ) : mySubjects.length ? (
              <div className="space-y-2">
                {mySubjects.slice(0, 5).map((s) => (
                  <div key={s._id} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {typeof s.classId === 'object' ? s.classId.name : ''}
                    </span>
                  </div>
                ))}
                {mySubjects.length > 5 && (
                  <Link href="/subjects" className="text-xs text-blue-600 hover:underline">
                    +{mySubjects.length - 5} more
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No subjects assigned yet</p>
            )}
          </CardContent>
        </Card>

        {/* Attendance stat */}
        <StatCard
          title="Class Attendance"
          value="91%"
          description="Average this week"
          icon={ClipboardList}
          color="orange"
          trend={3}
        />
      </div>

      {/* Weekly attendance chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Weekly Attendance</CardTitle>
          <CardDescription>Present vs absent in your class this week</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyAttendance} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="present" fill="#22c55e" radius={[4, 4, 0, 0]} name="Present" />
              <Bar dataKey="absent"  fill="#f87171" radius={[4, 4, 0, 0]} name="Absent" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* All subjects table if teacher teaches multiple classes */}
      {mySubjects.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">All My Subjects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {mySubjects.map((s) => (
                <div key={s._id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    {s.department && <p className="text-xs text-muted-foreground">{s.department}</p>}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {typeof s.classId === 'object' ? `${s.classId.name}${s.classId.stream ? ` ${s.classId.stream}` : ''}` : '—'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main Dashboard (admin / finance) ──────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore();
  const isAdmin   = ADMIN_ROLES.includes(user?.role);
  const isFinance = FINANCE_ROLES.includes(user?.role);
  const isTeacher = user?.role === 'teacher';

  // Teachers get their own focused dashboard
  if (isTeacher) return <TeacherDashboard user={user} />;

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => { const res = await dashboardApi.get(); return res.data.data; },
    enabled: isAdmin,
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', 'recent'],
    queryFn: async () => {
      const res = await feesApi.listPayments({ limit: 6 });
      return res.data;
    },
    enabled: isFinance,
  });

  const recentPayments = paymentsData?.payments ?? paymentsData?.data ?? [];

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayStr = now.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const feeChartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const month = d.toLocaleString('default', { month: 'short' });
    const total = recentPayments
      .filter((p) => {
        const pd = new Date(p.createdAt);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
      })
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    return { month, collected: total };
  });

  const trialDaysLeft   = summary?.school?.trialDaysLeft ?? null;
  const pendingStaff    = summary?.alerts?.staffAwaitingFirstLogin ?? 0;
  const termCollections = recentPayments.reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{greeting}, {user?.firstName}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {todayStr} · {summary?.school?.name ?? 'your school'}
          </p>
        </div>
      </div>

      <QuickActions isAdmin={isAdmin} isFinance={isFinance} />

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
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
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
                <Bar dataKey="absent"  fill="#f87171" radius={[4, 4, 0, 0]} name="Absent" />
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
              ) : recentPayments.length ? (
                <div className="divide-y">
                  {recentPayments.map((p) => (
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
