'use client';

import { useMemo, useState } from 'react';
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
import { dashboardApi, feesApi, classesApi, subjectsApi, attendanceApi, timetableApi, studentsApi, transportApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TERMS, CURRENT_YEAR, ACADEMIC_YEARS } from '@/lib/constants';
import Link from 'next/link';

const ADMIN_ROLES   = ['school_admin', 'director', 'headteacher', 'deputy_headteacher'];
const FINANCE_ROLES = [...ADMIN_ROLES, 'accountant', 'secretary'];

function QuickActions({ isAdmin: admin, isFinance: finance }) {
  const router = useRouter();
  const canEnroll = admin || finance;
  const actions = [
    { label: 'Take Attendance', icon: CalendarCheck, href: '/attendance', show: admin, color: 'text-green-600 bg-green-50 border-green-200' },
    { label: 'Enroll Student',  icon: Plus,          href: '/students',   show: canEnroll, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { label: 'Record Payment',  icon: CreditCard,    href: '/fees/payments', show: finance, color: 'text-purple-600 bg-purple-50 border-purple-200' },
    { label: 'Transport',       icon: Users,         href: '/transport',  show: finance, color: 'text-orange-600 bg-orange-50 border-orange-200' },
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

function FinanceOpsDashboard({ user }) {
  const [detail, setDetail] = useState(null);

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['finance-dashboard-payments'],
    queryFn: async () => {
      const res = await feesApi.listPayments({ limit: 120 });
      return res.data;
    },
  });

  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ['finance-dashboard-classes'],
    queryFn: async () => {
      const res = await classesApi.list({ limit: 200 });
      return res.data;
    },
  });

  const { data: studentData, isLoading: studentsLoading } = useQuery({
    queryKey: ['finance-dashboard-students'],
    queryFn: async () => {
      const res = await studentsApi.list({ limit: 1, status: 'active' });
      return res.data;
    },
  });

  const { data: routeData, isLoading: routesLoading } = useQuery({
    queryKey: ['finance-dashboard-routes'],
    queryFn: async () => {
      const res = await transportApi.listRoutes({ limit: 200 });
      return res.data;
    },
  });

  const payments = paymentsData?.payments ?? paymentsData?.data ?? [];
  const classes = classData?.classes ?? classData?.data ?? [];
  const routes = routeData?.routes ?? routeData?.data ?? [];
  const totalStudents = studentData?.meta?.total ?? studentData?.pagination?.total ?? 0;

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const month = now.getMonth();
  const year = now.getFullYear();

  const completedPayments = payments.filter((p) => p.status === 'completed');
  const todayCollections = completedPayments
    .filter((p) => (p.createdAt || '').slice(0, 10) === todayIso)
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const monthCollections = completedPayments
    .filter((p) => {
      const d = new Date(p.createdAt);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);

  const methodBreakdown = completedPayments.reduce((acc, p) => {
    const key = String(p.method ?? 'other').toUpperCase();
    acc[key] = (acc[key] ?? 0) + (p.amount ?? 0);
    return acc;
  }, {});

  const monthPaidStudentIds = new Set(
    completedPayments
      .filter((p) => {
        const d = new Date(p.createdAt);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .map((p) => String(typeof p.studentId === 'object' ? p.studentId?._id : p.studentId))
      .filter(Boolean)
  );
  const studentsPaidThisMonth = monthPaidStudentIds.size;
  const studentsToFollowUp = Math.max(0, totalStudents - studentsPaidThisMonth);
  const myUserId = String(user?._id ?? '');
  const unissuedReceipts = completedPayments.filter((p) => !p.receiptIssuedByUserId).length;
  const receiptsIssuedByMeToday = completedPayments.filter((p) => {
    const issuedBy = typeof p.receiptIssuedByUserId === 'object'
      ? p.receiptIssuedByUserId?._id
      : p.receiptIssuedByUserId;
    const issuedAt = String(p.receiptIssuedAt ?? '').slice(0, 10);
    return String(issuedBy) === myUserId && issuedAt === todayIso;
  }).length;
  const reversalsThisMonth = payments.filter((p) => {
    if (p.status !== 'reversed') return false;
    const d = new Date(p.updatedAt ?? p.createdAt);
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;
  const latestPayments = [...payments]
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
    .slice(0, 8);
  const pendingReceiptRows = completedPayments
    .filter((p) => !p.receiptIssuedByUserId)
    .slice(0, 8);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayStr = now.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{greeting}, {user?.firstName}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {todayStr} · Finance and operations
          </p>
        </div>
      </div>

      <QuickActions isAdmin={false} isFinance={true} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Collections"
          value={paymentsLoading ? '—' : formatCurrency(todayCollections)}
          description="Completed payments"
          icon={CreditCard}
          color="green"
          loading={paymentsLoading}
          onClick={() => setDetail({ key: 'todayCollections', title: "Today's Collections", description: 'Payments completed today.' })}
        />
        <StatCard
          title="This Month"
          value={paymentsLoading ? '—' : formatCurrency(monthCollections)}
          description="Completed payments"
          icon={FileText}
          color="blue"
          loading={paymentsLoading}
          onClick={() => setDetail({ key: 'monthCollections', title: 'Monthly Collections', description: 'Payments completed this month.' })}
        />
        <StatCard
          title="Active Students"
          value={studentsLoading ? '—' : totalStudents}
          description="School-wide count"
          icon={GraduationCap}
          color="purple"
          loading={studentsLoading}
          onClick={() => setDetail({ key: 'activeStudents', title: 'Active Students', description: 'Total active students in this school.' })}
        />
        <StatCard
          title="Routes / Classes"
          value={(routesLoading || classLoading) ? '—' : `${routes.length} / ${classes.length}`}
          description="Transport and classes"
          icon={Users}
          color="orange"
          loading={routesLoading || classLoading}
          onClick={() => setDetail({ key: 'routesClasses', title: 'Routes and Classes', description: 'Configured transport routes and classes.' })}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Paid This Month"
          value={paymentsLoading ? '—' : studentsPaidThisMonth}
          description="Unique students"
          icon={GraduationCap}
          color="green"
          loading={paymentsLoading}
          onClick={() => setDetail({ key: 'paidThisMonth', title: 'Students Paid This Month', description: 'Unique students with completed payments this month.' })}
        />
        <StatCard
          title="Need Follow-up"
          value={(paymentsLoading || studentsLoading) ? '—' : studentsToFollowUp}
          description="Est. unpaid this month"
          icon={AlertTriangle}
          color="orange"
          loading={paymentsLoading || studentsLoading}
          onClick={() => setDetail({ key: 'followUp', title: 'Students Needing Follow-up', description: 'Estimated students without completed payment this month.' })}
        />
        <StatCard
          title="Unissued Receipts"
          value={paymentsLoading ? '—' : unissuedReceipts}
          description="Completed, not issued"
          icon={FileText}
          color="purple"
          loading={paymentsLoading}
          onClick={() => setDetail({ key: 'unissuedReceipts', title: 'Unissued Receipts', description: 'Completed payments awaiting receipt issuance.' })}
        />
        <StatCard
          title="My Receipts Today"
          value={paymentsLoading ? '—' : receiptsIssuedByMeToday}
          description="Issued by you"
          icon={ClipboardList}
          color="blue"
          loading={paymentsLoading}
          onClick={() => setDetail({ key: 'myReceipts', title: 'My Receipts Today', description: 'Receipts issued by your account today.' })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Payment Method Breakdown</CardTitle>
            <CardDescription>Recent completed payments</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : Object.keys(methodBreakdown).length ? (
              <div className="divide-y">
                {Object.entries(methodBreakdown).map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-muted-foreground">{method}</span>
                    <span className="text-sm font-semibold">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No payment data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Operational Snapshot</CardTitle>
            <CardDescription>Classes and transport readiness</CardDescription>
          </CardHeader>
          <CardContent>
            {(classLoading || routesLoading) ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : (
              <div className="divide-y">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-muted-foreground">Configured classes</span>
                  <span className="text-sm font-semibold">{classes.length}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-muted-foreground">Configured routes</span>
                  <span className="text-sm font-semibold">{routes.length}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-muted-foreground">Has active routes</span>
                  <span className="text-sm font-semibold">{routes.some((r) => r.isActive !== false) ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <Link href="/transport" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                    Open transport <ChevronRight className="h-3 w-3" />
                  </Link>
                  <Link href="/classes" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                    Open classes <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Work Queue</CardTitle>
          <CardDescription>Recommended daily follow-ups</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : (
            <div className="divide-y">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground">Issue pending receipts</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{unissuedReceipts}</span>
                  <Link href="/fees/payments" className="text-xs text-blue-600 hover:underline">Open</Link>
                </div>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground">Student fee follow-up</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{studentsToFollowUp}</span>
                  <Link href="/students" className="text-xs text-blue-600 hover:underline">Open</Link>
                </div>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground">Reversals this month</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{reversalsThisMonth}</span>
                  <Link href="/fees/payments" className="text-xs text-blue-600 hover:underline">Review</Link>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : payments.length ? (
            <div className="divide-y">
              {payments.slice(0, 10).map((p) => (
                <div key={p._id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{p.studentId?.firstName ?? 'Student'} {p.studentId?.lastName ?? ''}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)} · {(p.method ?? '—').toUpperCase()} · {p.status}</p>
                  </div>
                  <span className={`text-sm font-semibold ${p.status === 'completed' ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {formatCurrency(p.amount ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">No payments recorded yet</p>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 overflow-y-auto">
          <div className="p-6 space-y-4">
            <SheetHeader>
              <SheetTitle>{detail?.title ?? 'Details'}</SheetTitle>
              <SheetDescription>{detail?.description ?? 'Detailed breakdown'}</SheetDescription>
            </SheetHeader>

            {detail?.key === 'todayCollections' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Today Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Total collected</span><span className="font-semibold">{formatCurrency(todayCollections)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Completed payments</span><span className="font-semibold">{completedPayments.filter((p) => String(p.createdAt ?? '').slice(0, 10) === todayIso).length}</span></div>
                </CardContent>
              </Card>
            )}

            {detail?.key === 'monthCollections' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Month Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Total collected</span><span className="font-semibold">{formatCurrency(monthCollections)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Completed payments</span><span className="font-semibold">{completedPayments.filter((p) => { const d = new Date(p.createdAt); return d.getMonth() === month && d.getFullYear() === year; }).length}</span></div>
                </CardContent>
              </Card>
            )}

            {detail?.key === 'activeStudents' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Enrollment Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Active students</span><span className="font-semibold">{totalStudents}</span></div>
                  <Link href="/students" className="text-xs text-blue-600 hover:underline">Open student list</Link>
                </CardContent>
              </Card>
            )}

            {detail?.key === 'routesClasses' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Operations Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Configured routes</span><span className="font-semibold">{routes.length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Configured classes</span><span className="font-semibold">{classes.length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Active routes</span><span className="font-semibold">{routes.filter((r) => r.isActive !== false).length}</span></div>
                  <div className="flex gap-4 pt-1">
                    <Link href="/transport" className="text-xs text-blue-600 hover:underline">Open transport</Link>
                    <Link href="/classes" className="text-xs text-blue-600 hover:underline">Open classes</Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {detail?.key === 'paidThisMonth' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Students Paid This Month</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Unique students</span><span className="font-semibold">{studentsPaidThisMonth}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Collection value</span><span className="font-semibold">{formatCurrency(monthCollections)}</span></div>
                </CardContent>
              </Card>
            )}

            {detail?.key === 'followUp' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Follow-up Queue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Need follow-up</span><span className="font-semibold">{studentsToFollowUp}</span></div>
                  <p className="text-xs text-muted-foreground">Estimate based on active students vs paid-this-month students.</p>
                  <Link href="/students" className="text-xs text-blue-600 hover:underline">Open students</Link>
                </CardContent>
              </Card>
            )}

            {detail?.key === 'unissuedReceipts' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pending Receipt Issuance</CardTitle>
                </CardHeader>
                <CardContent>
                  {!pendingReceiptRows.length ? (
                    <p className="text-sm text-muted-foreground">No pending receipts.</p>
                  ) : (
                    <div className="divide-y">
                      {pendingReceiptRows.map((p) => (
                        <div key={p._id} className="flex items-center justify-between py-2.5">
                          <div>
                            <p className="text-sm font-medium">{p.studentId?.firstName ?? 'Student'} {p.studentId?.lastName ?? ''}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)} · {p.receiptNumber ?? 'No receipt no.'}</p>
                          </div>
                          <span className="text-sm font-semibold">{formatCurrency(p.amount ?? 0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Link href="/fees/payments" className="text-xs text-blue-600 hover:underline mt-3 inline-block">Open payments</Link>
                </CardContent>
              </Card>
            )}

            {detail?.key === 'myReceipts' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Your Issuance Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Issued today</span><span className="font-semibold">{receiptsIssuedByMeToday}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">System reversals (month)</span><span className="font-semibold">{reversalsThisMonth}</span></div>
                  <Link href="/fees/payments" className="text-xs text-blue-600 hover:underline">Open payments</Link>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent Payments</CardTitle>
              </CardHeader>
              <CardContent>
                {!latestPayments.length ? (
                  <p className="text-sm text-muted-foreground">No recent records.</p>
                ) : (
                  <div className="divide-y">
                    {latestPayments.map((p) => (
                      <div key={p._id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm font-medium">{p.studentId?.firstName ?? 'Student'} {p.studentId?.lastName ?? ''}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)} · {(p.method ?? '—').toUpperCase()} · {p.status}</p>
                        </div>
                        <span className="text-sm font-semibold">{formatCurrency(p.amount ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>
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
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

function getWeekStart() {
  const now = new Date();
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon.toISOString().split('T')[0];
}
const normalizeDay = (value) => {
  const day = String(value ?? '').toLowerCase();
  return DAYS.includes(day) ? day : DAYS[0];
};
const dayLabel = (value) => {
  const day = normalizeDay(value);
  return `${day[0].toUpperCase()}${day.slice(1)}`;
};
const firstArray = (...candidates) => {
  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }
  return [];
};

function TeacherDashboard({ user }) {
  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));

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

  const { data: myTimetableData, isLoading: timetableLoading } = useQuery({
    queryKey: ['teacher-dashboard-timetable', user?._id, selectedTerm, selectedYear],
    queryFn: async () => {
      const res = await timetableApi.list({
        teacherId: user?._id,
        term: selectedTerm,
        academicYear: selectedYear,
        limit: 50,
      });
      return firstArray(
        res.data?.data,
        res.data?.timetables,
        res.data?.data?.timetables,
      );
    },
    enabled: !!user?._id,
  });

  const mySlots = useMemo(() => {
    if (!myTimetableData) return [];
    const slots = [];
    for (const tt of myTimetableData) {
      const className = typeof tt.classId === 'object'
        ? `${tt.classId.name}${tt.classId.stream ? ` ${tt.classId.stream}` : ''}`
        : '—';
      for (const slot of tt.slots ?? []) {
        const tid = typeof slot.teacherId === 'object' ? slot.teacherId?._id : slot.teacherId;
        if (String(tid) === String(user?._id)) slots.push({ ...slot, className });
      }
    }
    return slots.sort(
      (a, b) => DAYS.indexOf(normalizeDay(a.day)) - DAYS.indexOf(normalizeDay(b.day)) || a.period - b.period
    );
  }, [myTimetableData, user?._id]);

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
          <p className="text-xs text-muted-foreground font-medium">My Timetable</p>
          {timetableLoading ? <Skeleton className="h-7 w-20" /> : (
            <p className="text-xl font-bold">{mySlots.length}</p>
          )}
          <p className="text-xs text-muted-foreground">lesson{mySlots.length !== 1 ? 's' : ''} in selected term</p>
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
        {/* My Timetable detail */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" /> My Timetable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 pb-3">
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {timetableLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : mySlots.length ? (
              <div className="space-y-3">
                <div className="divide-y">
                  {mySlots.slice(0, 8).map((slot, i) => {
                    const subject = typeof slot.subjectId === 'object' ? slot.subjectId : null;
                    return (
                      <div key={`${slot.day}-${slot.period}-${i}`} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs w-24 justify-center shrink-0">
                            {dayLabel(slot.day).slice(0, 3)} P{slot.period}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">{subject?.name ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">{slot.className}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {slot.startTime} – {slot.endTime}
                          {slot.room ? ` · ${slot.room}` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between pt-1 border-t">
                  <p className="text-xs text-muted-foreground">
                    {mySlots.length} lesson{mySlots.length !== 1 ? 's' : ''} total
                  </p>
                  <Link href="/timetable" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                    Open full schedule <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-2">
                <p className="text-sm text-muted-foreground">No lessons assigned for {selectedTerm} {selectedYear}</p>
                <p className="text-xs text-muted-foreground mt-1">Use Timetable → My Schedule to view your full calendar</p>
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
  const [adminDetail, setAdminDetail] = useState(null);
  const isAdmin   = ADMIN_ROLES.includes(user?.role);
  const isFinance = FINANCE_ROLES.includes(user?.role);
  const isTeacher = user?.role === 'teacher';
  const isFinanceOps = ['secretary', 'accountant'].includes(user?.role);

  // Teachers get their own focused dashboard
  if (isTeacher) return <TeacherDashboard user={user} />;
  if (isFinanceOps) return <FinanceOpsDashboard user={user} />;

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
  const { data: adminClassData, isLoading: adminClassLoading } = useQuery({
    queryKey: ['dashboard-admin-classes'],
    queryFn: async () => {
      const res = await classesApi.list({ limit: 200 });
      return res.data;
    },
    enabled: isAdmin,
  });
  const { data: adminRouteData, isLoading: adminRouteLoading } = useQuery({
    queryKey: ['dashboard-admin-routes'],
    queryFn: async () => {
      const res = await transportApi.listRoutes({ limit: 200 });
      return res.data;
    },
    enabled: isAdmin,
  });

  const recentPayments = paymentsData?.payments ?? paymentsData?.data ?? [];
  const adminClasses = adminClassData?.classes ?? adminClassData?.data ?? [];
  const adminRoutes = adminRouteData?.routes ?? adminRouteData?.data ?? [];

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
  const activeStudents = summary?.students?.byStatus?.active ?? 0;
  const inactiveStudents = summary?.students?.byStatus?.inactive ?? 0;
  const pendingStudents = summary?.students?.byStatus?.pending ?? 0;

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
          onClick={isAdmin ? () => setAdminDetail({ key: 'students', title: 'Students Overview', description: 'Enrollment status breakdown.' }) : undefined}
        />
        {isAdmin && (
          <StatCard
            title="Staff Members"
            value={summaryLoading ? '—' : (summary?.staff?.total ?? '—')}
            description="All roles"
            icon={Users} color="purple" loading={summaryLoading}
            onClick={() => setAdminDetail({ key: 'staff', title: 'Staff Overview', description: 'Active staff by role and onboarding state.' })}
          />
        )}
        {isFinance && (
          <StatCard
            title="Recent Collections"
            value={paymentsLoading ? '—' : formatCurrency(termCollections)}
            description="Last 6 months"
            icon={CreditCard} color="green" loading={paymentsLoading}
            onClick={() => setAdminDetail({ key: 'collections', title: 'Collections Overview', description: 'Fee collections in the selected period.' })}
          />
        )}
        <StatCard
          title="Inactive Students"
          value={summaryLoading ? '—' : inactiveStudents}
          description="Need retention follow-up"
          icon={AlertTriangle}
          color="orange"
          loading={summaryLoading && isAdmin}
          onClick={isAdmin ? () => setAdminDetail({ key: 'inactiveStudents', title: 'Inactive Students', description: 'Students currently marked inactive.' }) : undefined}
        />
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
            <CardTitle className="text-sm font-semibold">School Operations</CardTitle>
            <CardDescription>Quick operational snapshot for administrators</CardDescription>
          </CardHeader>
          <CardContent>
            {(adminClassLoading || adminRouteLoading || summaryLoading) ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : (
              <div className="divide-y">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-muted-foreground">Configured classes</span>
                  <span className="text-sm font-semibold">{adminClasses.length}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-muted-foreground">Transport routes</span>
                  <span className="text-sm font-semibold">{adminRoutes.length}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-muted-foreground">Pending staff onboarding</span>
                  <span className="text-sm font-semibold">{pendingStaff}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-muted-foreground">Students pending activation</span>
                  <span className="text-sm font-semibold">{pendingStudents}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <Link href="/classes" className="text-xs text-blue-600 hover:underline">Open classes</Link>
                  <Link href="/staff" className="text-xs text-blue-600 hover:underline">Open staff</Link>
                </div>
              </div>
            )}
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

      <Sheet open={!!adminDetail} onOpenChange={(open) => !open && setAdminDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 overflow-y-auto">
          <div className="p-6 space-y-4">
            <SheetHeader>
              <SheetTitle>{adminDetail?.title ?? 'Details'}</SheetTitle>
              <SheetDescription>{adminDetail?.description ?? 'Operational detail'}</SheetDescription>
            </SheetHeader>

            {adminDetail?.key === 'students' && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Enrollment Status</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Total students</span><span className="font-semibold">{summary?.students?.total ?? 0}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Active</span><span className="font-semibold">{activeStudents}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Inactive</span><span className="font-semibold">{inactiveStudents}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Pending</span><span className="font-semibold">{pendingStudents}</span></div>
                  <Link href="/students" className="text-xs text-blue-600 hover:underline">Open students</Link>
                </CardContent>
              </Card>
            )}

            {adminDetail?.key === 'staff' && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Staff Breakdown</CardTitle></CardHeader>
                <CardContent>
                  {Object.keys(summary?.staff?.byRole ?? {}).length ? (
                    <div className="divide-y">
                      {Object.entries(summary.staff.byRole).map(([role, count]) => (
                        <div key={role} className="flex items-center justify-between py-2.5">
                          <span className="text-sm text-muted-foreground capitalize">{role.replace(/_/g, ' ')}</span>
                          <span className="text-sm font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No role breakdown available.</p>}
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground">Awaiting first login: {pendingStaff}</p>
                    <Link href="/staff" className="text-xs text-blue-600 hover:underline">Open staff</Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {adminDetail?.key === 'collections' && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Collections</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Last 6 months</span><span className="font-semibold">{formatCurrency(termCollections)}</span></div>
                  <p className="text-xs text-muted-foreground">This reflects recently fetched completed payment records.</p>
                  <Link href="/fees/payments" className="text-xs text-blue-600 hover:underline">Open payments</Link>
                </CardContent>
              </Card>
            )}

            {adminDetail?.key === 'inactiveStudents' && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Retention Watchlist</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Inactive students</span><span className="font-semibold">{inactiveStudents}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Pending students</span><span className="font-semibold">{pendingStudents}</span></div>
                  <Link href="/students" className="text-xs text-blue-600 hover:underline">Open students</Link>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Immediate Actions</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending staff onboarding</span>
                  <span className="font-semibold">{pendingStaff}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Inactive students</span>
                  <span className="font-semibold">{inactiveStudents}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending students</span>
                  <span className="font-semibold">{pendingStudents}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <Link href="/staff" className="text-xs text-blue-600 hover:underline">Open staff</Link>
                  <Link href="/students" className="text-xs text-blue-600 hover:underline">Open students</Link>
                  <Link href="/classes" className="text-xs text-blue-600 hover:underline">Open classes</Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
