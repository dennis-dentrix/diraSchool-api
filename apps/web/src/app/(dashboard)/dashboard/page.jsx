'use client';

import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap, Users, CreditCard, ClipboardList,
  AlertTriangle, UserX, BookOpen, BookMarked, ChevronRight,
  Plus, FileText, CalendarCheck,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { dashboardApi, feesApi, classesApi, subjectsApi, attendanceApi } from '@/lib/api';
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
const TODAY_ISO = new Date().toISOString().split('T')[0];

function getWeekStart() {
  const now = new Date();
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon.toISOString().split('T')[0];
}

function TeacherDashboard({ user }) {
  const { data: myClassData, isLoading: classLoading } = useQuery({
    queryKey: ['my-class'],
    queryFn: async () => { const res = await classesApi.myClass(); return res.data; },
    retry: false,
  });

  const { data: mySubjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ['my-subjects'],
    queryFn: async () => { const res = await subjectsApi.mySubjects(); return res.data; },
  });

  const myClass    = myClassData?.data ?? myClassData;
  const mySubjects = mySubjectsData?.data ?? mySubjectsData ?? [];

  // Fetch weekly attendance for teacher's own class
  const { data: weekAttData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['teacher-attendance-week', myClass?._id],
    queryFn: async () => {
      const res = await attendanceApi.listRegisters({
        classId: myClass._id,
        from: getWeekStart(),
        to: TODAY_ISO,
        limit: 50,
      });
      return res.data;
    },
    enabled: !!myClass?._id,
  });

  const weekRegisters = weekAttData?.data ?? weekAttData?.registers ?? [];

  // Aggregate weekly stats
  const weekStats = weekRegisters.reduce(
    (acc, reg) => {
      for (const e of reg.entries ?? []) {
        acc[e.status] = (acc[e.status] ?? 0) + 1;
        acc.total += 1;
      }
      return acc;
    },
    { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
  );
  const attendanceRate = weekStats.total > 0
    ? Math.round((weekStats.present / weekStats.total) * 100)
    : null;

  // Today's register for this class
  const todayReg = weekRegisters.find((r) => {
    const d = typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10);
    return d === TODAY_ISO;
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayStr = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{greeting}, {user?.firstName}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{todayStr} · Your teaching overview</p>
        </div>
        <Link href="/attendance">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium bg-green-50 text-green-700 border-green-200 hover:shadow-sm active:scale-95 transition-all">
            <CalendarCheck className="h-4 w-4" /> Take Attendance
          </button>
        </Link>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4 space-y-1 bg-card hover:shadow-sm transition-shadow">
          <p className="text-xs text-muted-foreground font-medium">My Class</p>
          {classLoading ? <Skeleton className="h-7 w-20" /> : (
            <p className="text-xl font-bold">
              {myClass ? `${myClass.name}${myClass.stream ? ` ${myClass.stream}` : ''}` : '—'}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{myClass ? `${myClass.studentCount ?? 0} students` : 'Not assigned'}</p>
        </div>

        <div className="rounded-xl border p-4 space-y-1 bg-card hover:shadow-sm transition-shadow">
          <p className="text-xs text-muted-foreground font-medium">Subjects</p>
          {subjectsLoading ? <Skeleton className="h-7 w-12" /> : (
            <p className="text-xl font-bold">{mySubjects.length}</p>
          )}
          <p className="text-xs text-muted-foreground">assigned to you</p>
        </div>

        <div className={`rounded-xl border p-4 space-y-1 hover:shadow-sm transition-shadow ${
          attendanceRate !== null
            ? attendanceRate >= 80 ? 'bg-green-50/60' : attendanceRate >= 60 ? 'bg-amber-50/60' : 'bg-red-50/60'
            : 'bg-card'
        }`}>
          <p className="text-xs text-muted-foreground font-medium">Week Rate</p>
          {attendanceLoading ? <Skeleton className="h-7 w-16" /> : (
            <p className={`text-xl font-bold ${
              attendanceRate !== null
                ? attendanceRate >= 80 ? 'text-green-700' : attendanceRate >= 60 ? 'text-amber-700' : 'text-red-700'
                : ''
            }`}>
              {attendanceRate !== null ? `${attendanceRate}%` : '—'}
            </p>
          )}
          <p className="text-xs text-muted-foreground">this week</p>
        </div>

        <div className="rounded-xl border p-4 space-y-1 bg-card hover:shadow-sm transition-shadow">
          <p className="text-xs text-muted-foreground font-medium">Today</p>
          {classLoading || attendanceLoading ? <Skeleton className="h-7 w-20" /> : (
            <p className={`text-xl font-bold ${todayReg?.status === 'submitted' ? 'text-green-600' : todayReg ? 'text-amber-600' : 'text-muted-foreground'}`}>
              {!myClass ? '—' : todayReg?.status === 'submitted' ? 'Done' : todayReg ? 'Draft' : 'Pending'}
            </p>
          )}
          <p className="text-xs text-muted-foreground">register status</p>
        </div>
      </div>

      {/* Main content row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* My Class detail */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" /> My Class
            </CardTitle>
          </CardHeader>
          <CardContent>
            {classLoading ? (
              <Skeleton className="h-20" />
            ) : myClass ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xl font-bold">{myClass.name}{myClass.stream ? ` ${myClass.stream}` : ''}</p>
                  <p className="text-sm text-muted-foreground">{myClass.levelCategory} · {myClass.term} {myClass.academicYear}</p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>{myClass.studentCount ?? 0} enrolled students</span>
                  </div>
                  <Link href="/classes" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                    View class <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                {/* Weekly attendance bar */}
                {attendanceRate !== null && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>This week&apos;s attendance</span>
                      <span className="font-semibold text-foreground">{attendanceRate}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${attendanceRate >= 80 ? 'bg-green-500' : attendanceRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${attendanceRate}%` }}
                      />
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground pt-0.5">
                      <span className="text-green-700">{weekStats.present} present</span>
                      <span className="text-red-700">{weekStats.absent} absent</span>
                      {weekStats.late > 0 && <span className="text-amber-700">{weekStats.late} late</span>}
                    </div>
                  </div>
                )}
                {attendanceRate === null && !attendanceLoading && myClass && (
                  <p className="text-xs text-muted-foreground pt-1">No attendance taken this week yet.</p>
                )}
              </div>
            ) : (
              <div className="py-2">
                <p className="text-sm text-muted-foreground">No class assigned yet</p>
                <p className="text-xs text-muted-foreground mt-1">Contact your administrator to be assigned a class</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Subjects */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-purple-600" /> My Subjects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subjectsLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : mySubjects.length ? (
              <div className="divide-y">
                {mySubjects.map((s) => (
                  <div key={s._id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      {s.department && <p className="text-xs text-muted-foreground">{s.department}</p>}
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {typeof s.classId === 'object' ? `${s.classId.name}${s.classId.stream ? ` ${s.classId.stream}` : ''}` : '—'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-2">
                <p className="text-sm text-muted-foreground">No subjects assigned yet</p>
                <p className="text-xs text-muted-foreground mt-1">Contact your administrator to be assigned subjects</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent attendance registers */}
      {myClass && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Attendance — {myClass.name}{myClass.stream ? ` ${myClass.stream}` : ''}</CardTitle>
            <Link href="/attendance" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {attendanceLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : weekRegisters.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <ClipboardList className="h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No attendance taken this week yet</p>
                <Link href="/attendance">
                  <button className="text-xs text-blue-600 hover:underline mt-1">Take attendance →</button>
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {[...weekRegisters].reverse().map((reg) => {
                  const isSubmitted = reg.status === 'submitted';
                  const present = reg.entries?.filter((e) => e.status === 'present').length ?? 0;
                  const total = reg.entries?.length ?? 0;
                  const d = typeof reg.date === 'string' ? reg.date.slice(0, 10) : new Date(reg.date).toISOString().slice(0, 10);
                  const label = d === TODAY_ISO ? 'Today' : new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
                  return (
                    <div key={reg._id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{present}/{total} present</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSubmitted ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isSubmitted ? 'Submitted' : 'Draft'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
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
        <StatCard title="Attendance" value="—" description="No data yet" icon={ClipboardList} color="orange" />
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
            <div className="flex flex-col items-center justify-center h-[200px] text-center gap-2">
              <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No attendance data yet</p>
              <p className="text-xs text-muted-foreground">Attendance records will appear here once teachers start taking registers</p>
              <Link href="/attendance" className="text-xs text-blue-600 hover:underline mt-1">View attendance →</Link>
            </div>
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
