'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, CreditCard, AlertTriangle,
  TrendingUp, Calendar, Clock,
  AlertCircle, DollarSign,
  BookOpen, CalendarCheck,
  FileText, Plus,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { TERMS } from '@/lib/constants';
import Link from 'next/link';

const ADMIN_ROLES = ['school_admin', 'director', 'headteacher', 'deputy_headteacher'];
const FINANCE_ROLES = [...ADMIN_ROLES, 'accountant', 'secretary'];

// ═════════════════════════════════════════════════════════════════════════════════════
// 🎯 PRINCIPAL/HEADTEACHER DASHBOARD (Most Important - Fee Collection Focus)
// ═════════════════════════════════════════════════════════════════════════════════════

function PrincipalDashboard({ user, summary, isLoading }) {
  const router = useRouter();

  if (!summary) return null;

  const feeData = summary.fees ?? {};
  const studentData = summary.students ?? {};
  const attendanceData = summary.attendance ?? {};
  const staffData = summary.staff ?? {};

  // Fee collection metrics
  const totalFeesCollected = feeData.totalCollected ?? 0;
  const totalFeesTarget = feeData.totalTarget ?? 0;
  const feeCollectionPercent = totalFeesTarget > 0 ? Math.round((totalFeesCollected / totalFeesTarget) * 100) : 0;
  const studentsOverdue = feeData.studentsOverdue ?? 0;
  const amountOverdue = feeData.amountOverdue ?? 0;

  // Academic metrics
  const totalStudents = studentData.total ?? 0;
  const activeStudents = studentData.byStatus?.active ?? 0;
  const studentsAtRisk = studentData.academicRisk ?? 0;

  // Attendance metrics
  const todayAttendance = attendanceData.today?.percent ?? 0;
  const weekAttendance = attendanceData.week?.percent ?? 0;
  const chronicAbsentees = attendanceData.chronicAbsentees ?? 0;

  // Critical alerts (things that need immediate action)
  const alerts = [
    studentsOverdue > 20 && {
      severity: 'critical',
      icon: AlertTriangle,
      title: `${studentsOverdue} Students Overdue Fees`,
      detail: `${formatCurrency(amountOverdue)} outstanding`,
      action: 'Send Reminders',
      actionHref: '/fees',
    },
    studentsAtRisk > 15 && {
      severity: 'high',
      icon: AlertCircle,
      title: `${studentsAtRisk} Students At Academic Risk`,
      detail: 'Scoring below 40% in major subjects',
      action: 'Review',
      actionHref: '/report-cards',
    },
    todayAttendance < 85 && {
      severity: 'high',
      icon: AlertTriangle,
      title: `Low Attendance Today: ${todayAttendance}%`,
      detail: `${Math.round((100 - todayAttendance) * (totalStudents / 100))} students absent`,
      action: 'Investigate',
      actionHref: '/attendance',
    },
    chronicAbsentees > 10 && {
      severity: 'medium',
      icon: AlertCircle,
      title: `${chronicAbsentees} Chronic Absentees`,
      detail: 'Missing school regularly',
      action: 'Follow Up',
      actionHref: '/attendance',
    },
  ].filter(Boolean);

  const feeCritical = feeCollectionPercent < 70;
  const attendanceCritical = todayAttendance < 85;

  return (
    <div className="space-y-6">
      {/* Header with greeting */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{user?.firstName}, Welcome Back</h1>
          <p className="text-gray-600 mt-1">{summary?.school?.name}</p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p className="font-medium">{new Date().toLocaleDateString('en-KE', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        </div>
      </div>

      {/* CRITICAL ALERTS - Red Zone */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-red-900 uppercase tracking-wide">⚠️ Attention Required</h2>
          {alerts.map((alert, idx) => {
            const AlertIcon = alert.icon;
            const bgColor = alert.severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';
            const textColor = alert.severity === 'critical' ? 'text-red-900' : 'text-yellow-900';

            return (
              <div
                key={idx}
                onClick={() => router.push(alert.actionHref)}
                className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition ${bgColor} hover:shadow-md`}
              >
                <AlertIcon className={`h-5 w-5 mt-0.5 shrink-0 ${alert.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'}`} />
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold text-sm ${textColor}`}>{alert.title}</h3>
                  <p className="text-xs text-gray-600 mt-0.5">{alert.detail}</p>
                </div>
                <button className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${alert.severity === 'critical'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-yellow-600 text-white hover:bg-yellow-700'
                  }`}>
                  {alert.action}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* KEY METRICS - The Big 4 Things Principals Care About */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fee Collection - BIGGEST PRIORITY */}
        <div
          onClick={() => router.push('/fees')}
          className={`p-5 rounded-xl border-2 cursor-pointer transition hover:shadow-lg ${feeCritical
              ? 'bg-red-50 border-red-300'
              : 'bg-green-50 border-green-300'
            }`}
        >
          <div className="flex items-start justify-between mb-3">
            <DollarSign className={`h-6 w-6 ${feeCritical ? 'text-red-600' : 'text-green-600'}`} />
            <span className={`text-xs font-bold px-2 py-1 rounded ${feeCritical ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>
              {feeCollectionPercent}%
            </span>
          </div>
          <h3 className="font-bold text-gray-900">Fee Collection</h3>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalFeesCollected)}</p>
          <p className="text-xs text-gray-600 mt-2">Target: {formatCurrency(totalFeesTarget)}</p>
          {studentsOverdue > 0 && (
            <p className="text-xs font-semibold text-red-600 mt-1">⚠️ {studentsOverdue} students overdue</p>
          )}
        </div>

        {/* Attendance - CRITICAL FOR MINISTRY REPORTING */}
        <div
          onClick={() => router.push('/attendance')}
          className={`p-5 rounded-xl border-2 cursor-pointer transition hover:shadow-lg ${attendanceCritical
              ? 'bg-orange-50 border-orange-300'
              : 'bg-blue-50 border-blue-300'
            }`}
        >
          <div className="flex items-start justify-between mb-3">
            <Calendar className={`h-6 w-6 ${attendanceCritical ? 'text-orange-600' : 'text-blue-600'}`} />
            <span className={`text-xs font-bold px-2 py-1 rounded ${attendanceCritical ? 'bg-orange-200 text-orange-800' : 'bg-blue-200 text-blue-800'}`}>
              {todayAttendance}%
            </span>
          </div>
          <h3 className="font-bold text-gray-900">Attendance Today</h3>
          <p className="text-2xl font-bold mt-1">{Math.round(totalStudents * (todayAttendance / 100))}/{totalStudents}</p>
          <p className="text-xs text-gray-600 mt-2">Week Avg: {weekAttendance}%</p>
          {chronicAbsentees > 0 && (
            <p className="text-xs font-semibold text-orange-600 mt-1">📋 {chronicAbsentees} chronic</p>
          )}
        </div>

        {/* Academic Health - EXAM PERFORMANCE */}
        <div
          onClick={() => router.push('/report-cards')}
          className="p-5 rounded-xl border-2 border-purple-300 bg-purple-50 cursor-pointer transition hover:shadow-lg"
        >
          <div className="flex items-start justify-between mb-3">
            <BookOpen className="h-6 w-6 text-purple-600" />
            <span className="text-xs font-bold px-2 py-1 rounded bg-purple-200 text-purple-800">
              {totalStudents}
            </span>
          </div>
          <h3 className="font-bold text-gray-900">Total Students</h3>
          <p className="text-2xl font-bold mt-1">{activeStudents} Active</p>
          <p className="text-xs text-gray-600 mt-2">{totalStudents - activeStudents} inactive/pending</p>
          {studentsAtRisk > 0 && (
            <p className="text-xs font-semibold text-red-600 mt-1">🔴 {studentsAtRisk} at risk</p>
          )}
        </div>

        {/* Staff Status */}
        <div
          onClick={() => router.push('/staff')}
          className="p-5 rounded-xl border-2 border-gray-300 bg-gray-50 cursor-pointer transition hover:shadow-lg"
        >
          <div className="flex items-start justify-between mb-3">
            <Users className="h-6 w-6 text-gray-600" />
            <span className="text-xs font-bold px-2 py-1 rounded bg-gray-200 text-gray-800">
              {staffData.total ?? 0}
            </span>
          </div>
          <h3 className="font-bold text-gray-900">Staff Members</h3>
          <p className="text-2xl font-bold mt-1">{staffData.active ?? 0}</p>
          <p className="text-xs text-gray-600 mt-2">Total on payroll</p>
          {staffData.pendingOnboarding > 0 && (
            <p className="text-xs font-semibold text-blue-600 mt-1">⏳ {staffData.pendingOnboarding} pending</p>
          )}
        </div>
      </div>

      {/* TWO MAIN SECTIONS: Fees + Academic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fee Breakdown by Class */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="pb-3 border-b bg-gradient-to-r from-green-50 to-emerald-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Fee Status by Class
              </CardTitle>
              <Link href="/fees/structures" className="text-xs text-blue-600 hover:underline">View All →</Link>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {isLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : feeData.byClass && Object.keys(feeData.byClass).length > 0 ? (
              Object.entries(feeData.byClass).map(([className, classData]) => (
                <div key={className} className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm text-gray-900">{className}</h4>
                    <span className="text-xs font-bold text-green-600">{classData.percent}% Paid</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${classData.percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{classData.paidCount}/{classData.total} students</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-600 text-center py-4">No fee data available</p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Important Dates & Events */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="pb-3 border-b bg-gradient-to-r from-blue-50 to-cyan-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Important Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {[
              { date: 'Fri, Apr 5', event: 'Parent-Teacher Meetings', priority: 'high' },
              { date: 'Mon, Apr 15', event: 'Mid-term Exams Begin', priority: 'high' },
              { date: 'Fri, May 3', event: 'Fee Collection Deadline (Term 2)', priority: 'critical' },
              { date: 'Mon, May 12', event: 'Board of Governors Meeting', priority: 'medium' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500">{item.date}</p>
                  <p className="text-sm font-semibold text-gray-900">{item.event}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => router.push('/fees/payments')}
          className="gap-2 bg-green-600 hover:bg-green-700"
        >
          <CreditCard className="h-4 w-4" /> Record Payment
        </Button>
        <Button
          onClick={() => router.push('/attendance')}
          variant="outline"
          className="gap-2"
        >
          <CalendarCheck className="h-4 w-4" /> Mark Attendance
        </Button>
        <Button
          onClick={() => router.push('/students')}
          variant="outline"
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Enroll Student
        </Button>
        <Button
          onClick={() => router.push('/report-cards')}
          variant="outline"
          className="gap-2"
        >
          <FileText className="h-4 w-4" /> Post Grades
        </Button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 💰 FINANCE/SECRETARY DASHBOARD (Payment Focus)
// ═════════════════════════════════════════════════════════════════════════════════════

function FinanceDashboard({ user, summary, isLoading }) {
  const router = useRouter();

  if (!summary) return null;

  const feeData = summary.fees ?? {};
  const todayCollections = feeData.todayAmount ?? 0;
  const monthCollections = feeData.monthAmount ?? 0;
  const pendingReceipts = feeData.pendingReceipts ?? 0;
  const studentsToFollowUp = feeData.studentsToFollowUp ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-gray-600 mt-1">{user?.firstName} · {summary?.school?.name}</p>
        </div>
      </div>

      {/* URGENT: Unissued Receipts */}
      {pendingReceipts > 0 && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-red-900">{pendingReceipts} Payments Pending Receipt Issuance</h3>
            <p className="text-xs text-red-700 mt-1">Issue receipts to complete transaction records</p>
          </div>
          <Button
            size="sm"
            onClick={() => router.push('/fees/payments')}
            className="bg-red-600 hover:bg-red-700"
          >
            Issue Receipts
          </Button>
        </div>
      )}

      {/* Key Finance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => router.push('/fees/payments')}
          className="p-5 rounded-xl border-2 border-green-300 bg-green-50 cursor-pointer hover:shadow-lg transition"
        >
          <DollarSign className="h-6 w-6 text-green-600 mb-2" />
          <p className="text-xs text-gray-600 font-medium">Today's Collections</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{formatCurrency(todayCollections)}</p>
          <p className="text-xs text-gray-600 mt-2">Completed payments</p>
        </div>

        <div
          onClick={() => router.push('/fees/payments')}
          className="p-5 rounded-xl border-2 border-blue-300 bg-blue-50 cursor-pointer hover:shadow-lg transition"
        >
          <TrendingUp className="h-6 w-6 text-blue-600 mb-2" />
          <p className="text-xs text-gray-600 font-medium">Month To Date</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">{formatCurrency(monthCollections)}</p>
          <p className="text-xs text-gray-600 mt-2">This month total</p>
        </div>

        <div
          onClick={() => router.push('/fees')}
          className="p-5 rounded-xl border-2 border-orange-300 bg-orange-50 cursor-pointer hover:shadow-lg transition"
        >
          <AlertCircle className="h-6 w-6 text-orange-600 mb-2" />
          <p className="text-xs text-gray-600 font-medium">Follow-up Needed</p>
          <p className="text-3xl font-bold text-orange-700 mt-1">{studentsToFollowUp}</p>
          <p className="text-xs text-gray-600 mt-2">Students to contact</p>
        </div>
      </div>

      {/* Recent Payments Table */}
      <Card className="border-2 border-gray-200">
        <CardHeader className="pb-3 border-b bg-gradient-to-r from-gray-50 to-slate-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Payments</CardTitle>
            <Link href="/fees/payments" className="text-xs text-blue-600 hover:underline">View All →</Link>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="space-y-2">
              {[
                { name: 'John Kipchoge', amount: 45000, method: 'M-Pesa', time: '10:45 AM', status: 'Completed' },
                { name: 'Mary Wanjiru', amount: 35000, method: 'Bank', time: '09:20 AM', status: 'Completed' },
                { name: 'Peter Okonkwo', amount: 50000, method: 'M-Pesa', time: '08:15 AM', status: 'Pending' },
              ].map((payment, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{payment.name}</p>
                    <p className="text-xs text-gray-600">{payment.method} · {payment.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-green-600">{formatCurrency(payment.amount)}</p>
                    <Badge variant={payment.status === 'Completed' ? 'default' : 'outline'} className="text-xs mt-1">
                      {payment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions for Finance */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => router.push('/fees/payments')} className="gap-2 bg-green-600 hover:bg-green-700">
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
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 👨‍🏫 TEACHER DASHBOARD (Class + Attendance Focus)
// ═════════════════════════════════════════════════════════════════════════════════════

function TeacherDashboard({ user, isLoading }) {
  const router = useRouter();
  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);

  // Simulated data - replace with actual API calls
  const myClass = { name: 'Form 1A', totalStudents: 45 };
  const todayRegisterStatus = 'pending'; // or 'submitted' or 'draft'
  const weekAttendanceRate = 92;
  const myLessonsThisWeek = 8;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.firstName}</h1>
          <p className="text-gray-600 mt-1">Class Teacher: {myClass.name}</p>
        </div>
        <Button
          onClick={() => router.push('/attendance')}
          className="gap-2 bg-green-600 hover:bg-green-700"
        >
          <CalendarCheck className="h-4 w-4" /> Take Attendance
        </Button>
      </div>

      {/* Today's Action Item */}
      {todayRegisterStatus === 'pending' && (
        <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg flex items-start gap-3">
          <Clock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-blue-900">Register Not Yet Submitted</h3>
            <p className="text-xs text-blue-700 mt-1">Submit today's attendance for {myClass.name} before end of day</p>
          </div>
          <Button
            size="sm"
            onClick={() => router.push('/attendance')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Submit Now
          </Button>
        </div>
      )}

      {/* Key Stats for Teacher */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border-2 border-blue-300 bg-blue-50">
          <Users className="h-6 w-6 text-blue-600 mb-2" />
          <p className="text-xs text-gray-600">My Class</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">{myClass.totalStudents}</p>
          <p className="text-xs text-gray-600 mt-1">{myClass.name} · Students</p>
        </div>

        <div className="p-5 rounded-xl border-2 border-green-300 bg-green-50">
          <Calendar className="h-6 w-6 text-green-600 mb-2" />
          <p className="text-xs text-gray-600">This Week Attendance</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{weekAttendanceRate}%</p>
          <p className="text-xs text-gray-600 mt-1">Average attendance rate</p>
        </div>

        <div className="p-5 rounded-xl border-2 border-purple-300 bg-purple-50">
          <BookOpen className="h-6 w-6 text-purple-600 mb-2" />
          <p className="text-xs text-gray-600">Timetable</p>
          <p className="text-3xl font-bold text-purple-700 mt-1">{myLessonsThisWeek}</p>
          <p className="text-xs text-gray-600 mt-1">Lessons this week</p>
        </div>
      </div>

      {/* My Timetable */}
      <Card className="border-2 border-gray-200">
        <CardHeader className="pb-3 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-600" />
            My Timetable
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2">
            {[
              { day: 'Mon', period: 1, subject: 'English', class: 'Form 1A', time: '8:00-8:40' },
              { day: 'Mon', period: 3, subject: 'History', class: 'Form 2B', time: '9:30-10:10' },
              { day: 'Tue', period: 2, subject: 'English', class: 'Form 1A', time: '8:40-9:20' },
              { day: 'Wed', period: 1, subject: 'English', class: 'Form 1A', time: '8:00-8:40' },
            ].map((lesson, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{lesson.subject}</p>
                  <p className="text-xs text-gray-600">{lesson.class} · {lesson.day} Period {lesson.period}</p>
                </div>
                <p className="text-xs font-medium text-gray-500">{lesson.time}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Attendance Records */}
      <Card className="border-2 border-gray-200">
        <CardHeader className="pb-3 border-b bg-gradient-to-r from-green-50 to-emerald-50">
          <CardTitle className="text-base">Recent Attendance - {myClass.name}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2">
            {[
              { date: 'Today (Wed)', present: 42, absent: 3, status: 'Pending' },
              { date: 'Tuesday', present: 44, absent: 1, status: 'Submitted' },
              { date: 'Monday', present: 43, absent: 2, status: 'Submitted' },
            ].map((record, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{record.date}</p>
                  <p className="text-xs text-gray-600">✓ {record.present} present · ✕ {record.absent} absent</p>
                </div>
                <Badge variant={record.status === 'Submitted' ? 'default' : 'outline'}>
                  {record.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => router.push('/attendance')} className="w-full gap-2 bg-green-600 hover:bg-green-700">
        <CalendarCheck className="h-4 w-4" /> Full Attendance View
      </Button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 🎯 MAIN DASHBOARD - Routes to appropriate role dashboard
// ═════════════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const { user } = useAuthStore();

  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const isFinance = FINANCE_ROLES.includes(user?.role) && !isAdmin;
  const isTeacher = ['teacher', 'department_head'].includes(user?.role);

  // Fetch appropriate data based on role
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

  // Role-based routing
  if (isTeacher) {
    return <TeacherDashboard user={user} isLoading={isLoading} />;
  }

  if (isAdmin) {
    return <PrincipalDashboard user={user} summary={summary} isLoading={isLoading} />;
  }

  if (isFinance) {
    return <FinanceDashboard user={user} summary={summary} isLoading={isLoading} />;
  }

  return (
    <div className="flex items-center justify-center h-96 text-center">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Not Available</h2>
        <p className="text-gray-600 mt-2">Your role doesn't have a configured dashboard yet</p>
      </div>
    </div>
  );
}
