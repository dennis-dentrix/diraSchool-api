'use client';

import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap, BookOpen, CreditCard, ClipboardList,
  TrendingUp, AlertCircle, Users, FileText,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { studentsApi, feesApi, attendanceApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';

const feeChartData = [
  { month: 'Jan', collected: 420000, expected: 500000 },
  { month: 'Feb', collected: 380000, expected: 500000 },
  { month: 'Mar', collected: 460000, expected: 500000 },
  { month: 'Apr', collected: 390000, expected: 500000 },
];

const attendanceChartData = [
  { day: 'Mon', present: 92, absent: 8 },
  { day: 'Tue', present: 88, absent: 12 },
  { day: 'Wed', present: 95, absent: 5 },
  { day: 'Thu', present: 90, absent: 10 },
  { day: 'Fri', present: 85, absent: 15 },
];

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', 'count'],
    queryFn: async () => {
      const res = await studentsApi.list({ limit: 1 });
      return res.data;
    },
  });

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff', 'count'],
    queryFn: async () => {
      const res = await usersApi.list({ limit: 1 });
      return res.data;
    },
    enabled: ['school_admin', 'director', 'headteacher', 'deputy_headteacher'].includes(user?.role),
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', 'recent'],
    queryFn: async () => {
      const res = await feesApi.listPayments({ limit: 5 });
      return res.data;
    },
    enabled: ['school_admin', 'director', 'headteacher', 'deputy_headteacher', 'accountant', 'secretary'].includes(user?.role),
  });

  const isAdmin = ['school_admin', 'director', 'headteacher', 'deputy_headteacher'].includes(user?.role);
  const isFinance = [...['school_admin', 'director', 'headteacher', 'deputy_headteacher'], 'accountant', 'secretary'].includes(user?.role);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          {user?.firstName} 👋
        </h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Here's what's happening in your school today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={studentsData?.pagination?.total ?? '—'}
          icon={GraduationCap}
          color="blue"
          loading={studentsLoading}
          description="Enrolled & active"
        />
        {isAdmin && (
          <StatCard
            title="Staff Members"
            value={staffData?.pagination?.total ?? '—'}
            icon={Users}
            color="purple"
            loading={staffLoading}
            description="All roles"
          />
        )}
        {isFinance && (
          <StatCard
            title="This Term Collections"
            value={formatCurrency(paymentsData?.data?.reduce((s, p) => s + (p.amount ?? 0), 0) ?? 0)}
            icon={CreditCard}
            color="green"
            loading={paymentsLoading}
            description="Fee payments recorded"
          />
        )}
        <StatCard
          title="Attendance Rate"
          value="91%"
          icon={ClipboardList}
          color="orange"
          description="This week average"
          trend={3}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isFinance && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fee Collection</CardTitle>
              <CardDescription>Collected vs expected per month</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={feeChartData}>
                  <defs>
                    <linearGradient id="collected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="expected" stroke="#e2e8f0" fill="none" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="collected" stroke="#3b82f6" fill="url(#collected)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly Attendance</CardTitle>
            <CardDescription>Present vs absent — this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={attendanceChartData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="present" fill="#22c55e" radius={[4, 4, 0, 0]} name="Present" />
                <Bar dataKey="absent" fill="#f87171" radius={[4, 4, 0, 0]} name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent payments */}
      {isFinance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : paymentsData?.data?.length ? (
              <div className="space-y-3">
                {paymentsData.data.map((payment) => (
                  <div key={payment._id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">
                        {payment.studentId?.firstName ?? 'Student'} {payment.studentId?.lastName ?? ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.createdAt)} · {payment.method?.toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(payment.amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent payments</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
