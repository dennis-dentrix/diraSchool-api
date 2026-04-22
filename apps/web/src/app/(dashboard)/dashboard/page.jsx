'use client';

import { useQuery } from '@tanstack/react-query';
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
import { dashboardApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency } from '@/lib/utils';
import { TERMS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const ADMIN_ROLES = ['school_admin', 'director', 'headteacher', 'deputy_headteacher'];
const FINANCE_ROLES = [...ADMIN_ROLES, 'accountant', 'secretary'];

function DashboardShell({ title, subtitle, rightMeta, children }) {
  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-gradient-to-br from-slate-50 via-white to-cyan-50/40">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
            <div className="text-sm text-slate-500 sm:text-right">{rightMeta}</div>
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
          tone={feeCollectionPercent < 70 ? 'rose' : 'green'}
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
          action={<Link href="/fees/structures" className="text-xs font-medium text-cyan-700 hover:underline">View all</Link>}
        >
          {isLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : feeData.byClass && Object.keys(feeData.byClass).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(feeData.byClass).map(([className, classData]) => (
                <div key={className} className="rounded-lg border border-slate-200/80 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{className}</p>
                    <p className="text-xs font-semibold text-cyan-700">{classData.percent}% paid</p>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-cyan-500 transition-all"
                      style={{ width: `${Math.min(100, classData.percent)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">{classData.paidCount}/{classData.total} students</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No fee data available.</p>
          )}
        </SectionCard>

        <SectionCard title="Upcoming Dates" icon={Clock}>
          <div className="space-y-3">
            {[
              { date: 'Fri, Apr 5', event: 'Parent-Teacher meetings' },
              { date: 'Mon, Apr 15', event: 'Mid-term exams begin' },
              { date: 'Fri, May 3', event: 'Term 2 fee deadline' },
              { date: 'Mon, May 12', event: 'Board of governors meeting' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-lg border border-slate-200/70 p-3">
                <Calendar className="mt-0.5 h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500">{item.date}</p>
                  <p className="text-sm font-medium text-slate-900">{item.event}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => router.push('/fees/payments')} className="gap-2 bg-cyan-700 hover:bg-cyan-800">
          <CreditCard className="h-4 w-4" /> Record Payment
        </Button>
        <Button onClick={() => router.push('/attendance')} variant="outline" className="gap-2">
          <CalendarCheck className="h-4 w-4" /> Mark Attendance
        </Button>
        <Button onClick={() => router.push('/students')} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" /> Enroll Student
        </Button>
        <Button onClick={() => router.push('/report-cards')} variant="outline" className="gap-2">
          <FileText className="h-4 w-4" /> Post Grades
        </Button>
      </div>
    </DashboardShell>
  );
}

function FinanceDashboard({ user, summary, isLoading }) {
  const router = useRouter();
  if (!summary) return null;

  const feeData = summary.fees ?? {};
  const todayCollections = feeData.todayAmount ?? 0;
  const monthCollections = feeData.monthAmount ?? 0;
  const pendingReceipts = feeData.pendingReceipts ?? 0;
  const studentsToFollowUp = feeData.studentsToFollowUp ?? 0;

  return (
    <DashboardShell
      title={`Welcome, ${user?.firstName || 'Finance'}`}
      subtitle="Finance overview"
      rightMeta="Collections and receipting"
    >
      {pendingReceipts > 0 ? (
        <Card className="border-rose-200 bg-rose-50/60">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-700 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose-900">{pendingReceipts} payments need receipt issuance</p>
                <p className="text-xs text-rose-800/80">Complete receipting to close these transactions.</p>
              </div>
            </div>
            <Button size="sm" onClick={() => router.push('/fees/payments')} className="bg-rose-700 hover:bg-rose-800">
              Issue receipts
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
          hint="This month total"
          icon={TrendingUp}
          tone="blue"
          onClick={() => router.push('/fees/payments')}
        />
        <StatCard
          label="Follow-up Needed"
          value={studentsToFollowUp}
          hint="Students to contact"
          icon={AlertCircle}
          tone="amber"
          onClick={() => router.push('/fees')}
        />
      </div>

      <SectionCard
        title="Recent Payments"
        icon={CreditCard}
        action={<Link href="/fees/payments" className="text-xs font-medium text-cyan-700 hover:underline">View all</Link>}
      >
        {isLoading ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : (
          <div className="space-y-2">
            {[
              { name: 'John Kipchoge', amount: 45000, method: 'M-Pesa', time: '10:45 AM', status: 'Completed' },
              { name: 'Mary Wanjiru', amount: 35000, method: 'Bank', time: '09:20 AM', status: 'Completed' },
              { name: 'Peter Okonkwo', amount: 50000, method: 'M-Pesa', time: '08:15 AM', status: 'Pending' },
            ].map((payment, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200/80 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{payment.name}</p>
                  <p className="text-xs text-slate-600">{payment.method} · {payment.time}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(payment.amount)}</p>
                  <Badge variant={payment.status === 'Completed' ? 'default' : 'outline'} className="mt-1">
                    {payment.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

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
        <Button onClick={() => router.push('/fees')} variant="outline" className="gap-2">
          <AlertTriangle className="h-4 w-4" /> Follow-up List
        </Button>
      </div>
    </DashboardShell>
  );
}

function TeacherDashboard({ user }) {
  const router = useRouter();

  const myClass = { name: 'Form 1A', totalStudents: 45 };
  const todayRegisterStatus = 'pending';
  const weekAttendanceRate = 92;
  const myLessonsThisWeek = 8;

  return (
    <DashboardShell
      title={`Welcome, ${user?.firstName || 'Teacher'}`}
      subtitle={`Class teacher · ${myClass.name}`}
      rightMeta={`Current term: ${TERMS[0]}`}
    >
      {todayRegisterStatus === 'pending' ? (
        <Card className="border-blue-200 bg-blue-50/60">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-blue-700 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900">Today&apos;s register is not submitted</p>
                <p className="text-xs text-blue-800/80">Submit attendance for {myClass.name} before end of day.</p>
              </div>
            </div>
            <Button size="sm" onClick={() => router.push('/attendance')} className="bg-blue-700 hover:bg-blue-800">
              Submit now
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="My Class"
          value={myClass.totalStudents}
          hint={`${myClass.name} students`}
          icon={Users}
          tone="blue"
        />
        <StatCard
          label="Weekly Attendance"
          value={`${weekAttendanceRate}%`}
          hint="Average attendance rate"
          icon={Calendar}
          tone="green"
        />
        <StatCard
          label="Timetable"
          value={myLessonsThisWeek}
          hint="Lessons this week"
          icon={BookOpen}
          tone="violet"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="My Timetable" icon={BookOpen}>
          <div className="space-y-2">
            {[
              { day: 'Mon', period: 1, subject: 'English', class: 'Form 1A', time: '8:00-8:40' },
              { day: 'Mon', period: 3, subject: 'History', class: 'Form 2B', time: '9:30-10:10' },
              { day: 'Tue', period: 2, subject: 'English', class: 'Form 1A', time: '8:40-9:20' },
              { day: 'Wed', period: 1, subject: 'English', class: 'Form 1A', time: '8:00-8:40' },
            ].map((lesson, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200/80 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{lesson.subject}</p>
                  <p className="text-xs text-slate-600">{lesson.class} · {lesson.day} period {lesson.period}</p>
                </div>
                <p className="text-xs font-medium text-slate-500">{lesson.time}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={`Recent Attendance · ${myClass.name}`} icon={CalendarCheck}>
          <div className="space-y-2">
            {[
              { date: 'Today (Wed)', present: 42, absent: 3, status: 'Pending' },
              { date: 'Tuesday', present: 44, absent: 1, status: 'Submitted' },
              { date: 'Monday', present: 43, absent: 2, status: 'Submitted' },
            ].map((record, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200/80 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{record.date}</p>
                  <p className="text-xs text-slate-600">{record.present} present · {record.absent} absent</p>
                </div>
                <Badge variant={record.status === 'Submitted' ? 'default' : 'outline'}>
                  {record.status}
                </Badge>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <Button onClick={() => router.push('/attendance')} className="w-full gap-2 bg-cyan-700 hover:bg-cyan-800">
        <CalendarCheck className="h-4 w-4" /> Full Attendance View
      </Button>
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
