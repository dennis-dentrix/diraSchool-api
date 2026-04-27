'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Calendar,
  CalendarCheck,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { dashboardApi, settingsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TERMS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/shared/refresh-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const ADMIN_ROLES = ['school_admin', 'director', 'headteacher', 'deputy_headteacher'];
const FINANCE_ROLES = [...ADMIN_ROLES, 'accountant', 'secretary'];

function DashboardShell({ title, subtitle, rightMeta, actions, children }) {
  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-gradient-to-br from-slate-50 via-white to-cyan-50/40">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <div className="text-sm text-slate-500 sm:text-right">{rightMeta}</div>
            </div>
          </div>
        </CardContent>
      </Card>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'slate',
  onClick,
  badge,
}) {
  const toneClasses = {
    green: 'from-emerald-50 to-green-50 border-emerald-200/70 text-emerald-700',
    blue: 'from-blue-50 to-cyan-50 border-blue-200/70 text-blue-700',
    amber: 'from-amber-50 to-orange-50 border-amber-200/70 text-amber-700',
    violet: 'from-violet-50 to-purple-50 border-violet-200/70 text-violet-700',
    slate: 'from-slate-50 to-slate-100 border-slate-200/70 text-slate-700',
    rose: 'from-rose-50 to-red-50 border-rose-200/70 text-rose-700',
  };

  return (
    <Card
      className={`bg-gradient-to-br ${toneClasses[tone]} transition-all hover:shadow-md ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="rounded-lg bg-white/80 p-2">
            <Icon className="h-5 w-5" />
          </div>
          {badge ? (
            <Badge variant="secondary" className="bg-white/85 text-slate-700">{badge}</Badge>
          ) : null}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        {hint ? <p className="mt-1.5 text-xs text-slate-600">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function SectionCard({ title, icon: Icon, action, children }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <span className="rounded-md bg-slate-100 p-1.5">
              <Icon className="h-4 w-4 text-slate-700" />
            </span>
            {title}
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function PrincipalDashboard({ user, summary, isLoading }) {
  const router = useRouter();
  if (!summary) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: schoolSettings } = useQuery({
    queryKey: ['school-settings'],
    queryFn: async () => {
      const res = await settingsApi.get();
      return res.data?.settings ?? res.data?.data ?? res.data;
    },
  });

  const now = new Date();
  const upcomingEvents = (schoolSettings?.holidays ?? [])
    .filter((h) => new Date(h.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const pastEvents = (schoolSettings?.holidays ?? [])
    .filter((h) => new Date(h.date) < now)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 2);

  const feeData = summary.fees ?? {};
  const studentData = summary.students ?? {};
  const attendanceData = summary.attendance ?? {};
  const staffData = summary.staff ?? {};

  const totalFeesCollected = feeData.totalCollected ?? 0;
  const totalFeesTarget = feeData.totalTarget ?? 0;
  const feeCollectionPercent = totalFeesTarget > 0 ? Math.round((totalFeesCollected / totalFeesTarget) * 100) : 0;
  const studentsOverdue = feeData.studentsOverdue ?? 0;
  const amountOverdue = feeData.amountOverdue ?? 0;
  const totalStudents = studentData.total ?? 0;
  const activeStudents = studentData.byStatus?.active ?? 0;
  const studentsAtRisk = studentData.academicRisk ?? 0;
  const todayAttendance = attendanceData.today?.percent ?? 0;
  const weekAttendance = attendanceData.week?.percent ?? 0;
  const chronicAbsentees = attendanceData.chronicAbsentees ?? 0;

  const alerts = [
    studentsOverdue > 20 && {
      icon: AlertTriangle,
      title: `${studentsOverdue} students have overdue fees`,
      detail: `${formatCurrency(amountOverdue)} outstanding`,
      href: '/fees',
      severity: 'critical',
    },
    studentsAtRisk > 15 && {
      icon: AlertCircle,
      title: `${studentsAtRisk} students are academically at risk`,
      detail: 'Review current report card performance',
      href: '/report-cards',
      severity: 'high',
    },
    todayAttendance < 85 && {
      icon: AlertTriangle,
      title: `Attendance is ${todayAttendance}% today`,
      detail: `${Math.round((100 - todayAttendance) * (totalStudents / 100))} students absent`,
      href: '/attendance',
      severity: 'high',
    },
    chronicAbsentees > 10 && {
      icon: AlertCircle,
      title: `${chronicAbsentees} chronic absentees need follow-up`,
      detail: 'Coordinate with class teachers and guardians',
      href: '/attendance',
      severity: 'medium',
    },
  ].filter(Boolean);

  return (
    <DashboardShell
      title={`Welcome, ${user?.firstName || 'Admin'}`}
      rightMeta={new Date().toLocaleDateString('en-KE', { weekday: 'long', month: 'short', day: 'numeric' })}
      actions={<RefreshButton queryKeys={[['dashboard-summary']]} />}
    >
      {alerts.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {alerts.map((alert, idx) => {
            const Icon = alert.icon;
            const tone = alert.severity === 'critical'
              ? 'border-rose-200 bg-rose-50/70'
              : 'border-amber-200 bg-amber-50/70';
            return (
              <button
                type="button"
                key={idx}
                onClick={() => router.push(alert.href)}
                className={`w-full rounded-xl border p-4 text-left transition hover:shadow-sm ${tone}`}
              >
                <div className="flex items-start gap-3">
                  <span className="rounded-md bg-white/80 p-2">
                    <Icon className="h-4 w-4 text-slate-700" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                    <p className="mt-1 text-xs text-slate-600">{alert.detail}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Fee Collection"
          value={formatCurrency(totalFeesCollected)}
          hint={`Target ${formatCurrency(totalFeesTarget)}`}
          icon={DollarSign}
          badge={`${feeCollectionPercent}%`}
          tone={feeCollectionPercent >= 80 ? 'green' : feeCollectionPercent >= 50 ? 'amber' : 'rose'}
          onClick={() => router.push('/fees')}
        />
        <StatCard
          label="Attendance Today"
          value={`${todayAttendance}%`}
          hint={`Week average ${weekAttendance}%`}
          icon={Calendar}
          tone={todayAttendance < 85 ? 'amber' : 'blue'}
          onClick={() => router.push('/attendance')}
        />
        <StatCard
          label="Active Students"
          value={activeStudents}
          hint={`${Math.max(0, totalStudents - activeStudents)} inactive or pending`}
          icon={BookOpen}
          badge={`${studentsAtRisk} at risk`}
          tone="violet"
          onClick={() => router.push('/report-cards')}
        />
        <StatCard
          label="Staff Members"
          value={staffData.active ?? 0}
          hint={`${staffData.pendingOnboarding ?? 0} pending onboarding`}
          icon={Users}
          badge={`${staffData.total ?? 0} total`}
          tone="slate"
          onClick={() => router.push('/staff')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard
          title="Fee Status By Class"
          icon={DollarSign}
          action={<Link href="/fees/payments" className="text-xs font-medium text-rose-600 hover:underline">View Overdue</Link>}
        >
          {isLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : feeData.byClass && Object.keys(feeData.byClass).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(feeData.byClass)
                .sort(([, a], [, b]) => a.percent - b.percent)
                .map(([className, classData]) => {
                  const barColor = classData.percent >= 80 ? 'bg-emerald-500' : classData.percent >= 50 ? 'bg-amber-400' : 'bg-rose-500';
                  const labelColor = classData.percent >= 80 ? 'text-emerald-700' : classData.percent >= 50 ? 'text-amber-700' : 'text-rose-700';
                  return (
                    <div key={className} className="rounded-lg border border-slate-200/80 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{className}</p>
                        <p className={`text-xs font-semibold ${labelColor}`}>{classData.percent}% paid</p>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className={`h-2 rounded-full transition-all ${barColor}`}
                          style={{ width: `${Math.min(100, classData.percent)}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-slate-600">{classData.paidCount}/{classData.total} students</p>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No fee data available.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Upcoming Events"
          icon={Clock}
          action={<Link href="/settings" className="text-xs font-medium text-cyan-700 hover:underline">Manage</Link>}
        >
          {upcomingEvents.length > 0 ? (
            <div className="space-y-2">
              {upcomingEvents.map((ev) => (
                <div key={ev._id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200/80 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{ev.name}</p>
                    {ev.description && <p className="text-xs text-slate-500 mt-0.5">{ev.description}</p>}
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">{formatDate(ev.date)}</Badge>
                </div>
              ))}
              {pastEvents.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-slate-500 mb-2">Recent</p>
                  {pastEvents.map((ev) => (
                    <div key={ev._id} className="flex items-center justify-between gap-3 py-1.5 opacity-60">
                      <p className="text-xs text-slate-700">{ev.name}</p>
                      <span className="text-xs text-slate-400 shrink-0">{formatDate(ev.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-slate-500">No upcoming events scheduled.</p>
              <Link href="/settings" className="mt-1 text-xs text-cyan-700 hover:underline">Add an event</Link>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => router.push('/fees/payments')} className="gap-2 bg-cyan-700 hover:bg-cyan-800">
          <CreditCard className="h-4 w-4" /> Record Payment
        </Button>
        {studentsOverdue > 0 && (
          <Button onClick={() => router.push('/fees/payments')} variant="outline" className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50">
            <AlertTriangle className="h-4 w-4" /> View Overdue Payments
          </Button>
        )}
        <Button onClick={() => router.push('/attendance')} variant="outline" className="gap-2">
          <CalendarCheck className="h-4 w-4" /> Mark Attendance
        </Button>
        <Button onClick={() => router.push('/students')} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" /> Enroll Student
        </Button>
        <Button onClick={() => router.push('/results')} variant="outline" className="gap-2">
          <FileText className="h-4 w-4" /> View Results
        </Button>
      </div>
    </DashboardShell>
  );
}

function FinanceDashboard({ user, summary, isLoading }) {
  const router = useRouter();
  if (!summary) return null;

  const feeData = summary.fees ?? {};
  const todayCollections  = feeData.todayAmount       ?? 0;
  const monthCollections  = feeData.monthAmount        ?? 0;
  const pendingReceipts   = feeData.pendingReceipts    ?? 0;
  const studentsToFollowUp = feeData.studentsToFollowUp ?? 0;
  const methodBreakdown   = feeData.methodBreakdown    ?? {};
  const totalCollected    = feeData.totalCollected     ?? 0;

  const methodLabels = { cash: 'Cash', mpesa: 'M-Pesa', cheque: 'Cheque', bank_transfer: 'Bank Transfer' };

  return (
    <DashboardShell
      title={`Welcome, ${user?.firstName || 'Finance'}`}
      subtitle="Finance overview"
      rightMeta="Collections and receipting"
      actions={<RefreshButton queryKeys={[['dashboard-summary']]} />}
    >
      {pendingReceipts > 0 ? (
        <Card className="border-rose-200 bg-rose-50/60">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-700 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose-900">{pendingReceipts} payments awaiting confirmation</p>
                <p className="text-xs text-rose-800/80">Review and confirm these pending transactions.</p>
              </div>
            </div>
            <Button size="sm" onClick={() => router.push('/fees/payments')} className="bg-rose-700 hover:bg-rose-800">
              Review pending
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Today's Collections"
          value={formatCurrency(todayCollections)}
          hint="Completed payments"
          icon={DollarSign}
          tone="green"
          onClick={() => router.push('/fees/payments')}
        />
        <StatCard
          label="Month To Date"
          value={formatCurrency(monthCollections)}
          hint={`Total collected: ${formatCurrency(totalCollected)}`}
          icon={TrendingUp}
          tone="blue"
          onClick={() => router.push('/fees/payments')}
        />
        <StatCard
          label="Follow-up Needed"
          value={studentsToFollowUp}
          hint="Students with outstanding fees"
          icon={AlertCircle}
          tone="amber"
          onClick={() => router.push('/fees')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {Object.keys(methodBreakdown).length > 0 && (
          <SectionCard title="Collections by Method" icon={CreditCard}>
            <div className="space-y-2">
              {Object.entries(methodBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([method, amount]) => {
                  const pct = totalCollected > 0 ? Math.round((amount / totalCollected) * 100) : 0;
                  return (
                    <div key={method} className="rounded-lg border border-slate-200/80 p-3">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 capitalize">
                          {methodLabels[method] ?? method}
                        </p>
                        <p className="text-xs font-semibold text-slate-700">{formatCurrency(amount)}</p>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-cyan-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{pct}% of total</p>
                    </div>
                  );
                })}
            </div>
          </SectionCard>
        )}

        <SectionCard
          title="Recent Payments"
          icon={CreditCard}
          action={<Link href="/fees/payments" className="text-xs font-medium text-cyan-700 hover:underline">View all</Link>}
        >
          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
          ) : feeData.recentPayments?.length > 0 ? (
            <div className="space-y-2">
              {feeData.recentPayments.map((payment, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200/80 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{payment.name}</p>
                    <p className="text-xs text-slate-600 capitalize">{payment.method} · {payment.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(payment.amount)}</p>
                    <Badge variant="default" className="mt-1 capitalize">{payment.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No payments recorded today.</p>
          )}
        </SectionCard>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => router.push('/fees/payments')} className="gap-2 bg-cyan-700 hover:bg-cyan-800">
          <CreditCard className="h-4 w-4" /> Record Payment
        </Button>
        <Button onClick={() => router.push('/fees/payments')} variant="outline" className="gap-2">
          <FileText className="h-4 w-4" /> Issue Receipts
        </Button>
        <Button onClick={() => router.push('/fees')} variant="outline" className="gap-2">
          <TrendingUp className="h-4 w-4" /> Fee Reports
        </Button>
        {studentsToFollowUp > 0 && (
          <Button onClick={() => router.push('/fees')} variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
            <AlertTriangle className="h-4 w-4" /> Follow-up List
          </Button>
        )}
      </div>
    </DashboardShell>
  );
}

function TeacherDashboard({ user }) {
  const router = useRouter();

  const { data: classData, isLoading } = useQuery({
    queryKey: ['my-class'],
    queryFn: async () => {
      const { classesApi } = await import('@/lib/api');
      const res = await classesApi.myClass();
      return res.data.data;
    },
    enabled: !!user?._id,
  });

  const cls = classData?.class;
  const className = cls ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : '—';
  const studentCount = classData?.students?.length ?? 0;

  return (
    <DashboardShell
      title={`Welcome, ${user?.firstName || 'Teacher'}`}
      subtitle={cls ? `Class teacher · ${className}` : 'Teacher'}
      rightMeta={`Current term: ${TERMS[0]}`}
      actions={<RefreshButton queryKeys={[['my-class']]} />}
    >
      {cls && (
        <Card className="border-blue-200 bg-blue-50/60">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-blue-700 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900">Mark today&apos;s attendance</p>
                <p className="text-xs text-blue-800/80">Submit attendance for {className} before end of day.</p>
              </div>
            </div>
            <Button size="sm" onClick={() => router.push('/attendance')} className="bg-blue-700 hover:bg-blue-800">
              Go to Attendance
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <>{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24" />)}</>
        ) : cls ? (
          <>
            <StatCard
              label="My Class"
              value={studentCount}
              hint={`${className} students`}
              icon={Users}
              tone="blue"
              onClick={() => router.push('/students')}
            />
            <StatCard
              label="Attendance"
              value="View records"
              hint="Check attendance history"
              icon={CalendarCheck}
              tone="green"
              onClick={() => router.push('/attendance')}
            />
          </>
        ) : (
          <Card className="col-span-2 border-slate-200">
            <CardContent className="p-5 text-sm text-slate-500">
              You are not assigned as class teacher for any active class.
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => router.push('/attendance')} className="gap-2 bg-cyan-700 hover:bg-cyan-800">
          <CalendarCheck className="h-4 w-4" /> Attendance
        </Button>
        <Button onClick={() => router.push('/exams')} variant="outline" className="gap-2">
          <FileText className="h-4 w-4" /> Exams
        </Button>
        <Button onClick={() => router.push('/report-cards')} variant="outline" className="gap-2">
          <BookOpen className="h-4 w-4" /> Report Cards
        </Button>
      </div>
    </DashboardShell>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const isFinance = FINANCE_ROLES.includes(user?.role) && !isAdmin;
  const isTeacher = ['teacher', 'department_head'].includes(user?.role);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary', user?.role],
    queryFn: async () => {
      if (isAdmin || isFinance) {
        const res = await dashboardApi.get();
        return res.data.data;
      }
      return null;
    },
    enabled: !isTeacher && !!user?._id,
  });

  if (isTeacher) return <TeacherDashboard user={user} />;
  if (isAdmin) return <PrincipalDashboard user={user} summary={summary} isLoading={isLoading} />;
  if (isFinance) return <FinanceDashboard user={user} summary={summary} isLoading={isLoading} />;

  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <Card className="w-full max-w-lg border-border/70">
        <CardContent className="p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-900">Dashboard not available</h2>
          <p className="mt-1 text-sm text-slate-600">Your role does not have a configured dashboard yet.</p>
        </CardContent>
      </Card>
    </div>
  );
}
