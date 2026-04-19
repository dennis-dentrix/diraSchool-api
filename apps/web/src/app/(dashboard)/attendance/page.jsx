'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardCheck, ChevronRight, CheckCircle2, Clock, AlertCircle, BarChart3, Users } from 'lucide-react';
import { attendanceApi, classesApi, getErrorMessage } from '@/lib/api';
import { formatDate, capitalize } from '@/lib/utils';
import { useAuthStore, isAdmin } from '@/store/auth.store';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { TERMS, ACADEMIC_YEARS, CURRENT_YEAR } from '@/lib/constants';

const TODAY = new Date().toISOString().split('T')[0];

// ── Period helpers ─────────────────────────────────────────────────────────────
function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon);
  return {
    from: mon.toISOString().split('T')[0],
    to: TODAY,
  };
}

function getMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: first.toISOString().split('T')[0],
    to: TODAY,
  };
}

function getPeriodParams(period, term, academicYear) {
  if (period === 'daily')   return { from: TODAY, to: TODAY };
  if (period === 'weekly')  return getWeekRange();
  if (period === 'monthly') return getMonthRange();
  if (period === 'termly')  return { term, academicYear };
  return null;
}

// ── Aggregate registers → totals ───────────────────────────────────────────────
function aggregateRegisters(registers) {
  const totals = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
  for (const reg of registers) {
    for (const entry of reg.entries ?? []) {
      totals[entry.status] = (totals[entry.status] ?? 0) + 1;
      totals.total += 1;
    }
  }
  return totals;
}

function aggregateByClass(registers) {
  const map = {};
  for (const reg of registers) {
    const cls = reg.classId;
    const key = typeof cls === 'object' ? cls._id : cls;
    const label = typeof cls === 'object' ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : '—';
    if (!map[key]) map[key] = { label, present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    for (const entry of reg.entries ?? []) {
      map[key][entry.status] = (map[key][entry.status] ?? 0) + 1;
      map[key].total += 1;
    }
  }
  return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
}

// ── Summary stat card ──────────────────────────────────────────────────────────
function StatPill({ label, value, color }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl px-4 py-3 ${color}`}>
      <span className="text-xl font-bold tabular-nums">{value}</span>
      <span className="text-xs font-medium mt-0.5 opacity-80">{label}</span>
    </div>
  );
}

// ── Attendance Summary section ─────────────────────────────────────────────────
function AttendanceSummary({ classes }) {
  const [period, setPeriod] = useState('weekly');
  const [summaryClass, setSummaryClass] = useState('');
  const [term, setTerm] = useState(TERMS[0]);
  const [academicYear, setAcademicYear] = useState(String(CURRENT_YEAR));

  const periodParams = useMemo(() => getPeriodParams(period, term, academicYear), [period, term, academicYear]);

  const queryParams = useMemo(() => {
    const p = { limit: 500, status: 'submitted' };
    if (summaryClass) p.classId = summaryClass;
    if (periodParams?.from) p.from = periodParams.from;
    if (periodParams?.to)   p.to   = periodParams.to;
    if (periodParams?.term) p.term = periodParams.term;
    if (periodParams?.academicYear) p.academicYear = periodParams.academicYear;
    return p;
  }, [periodParams, summaryClass]);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-summary', queryParams],
    queryFn: async () => {
      const res = await attendanceApi.listRegisters(queryParams);
      return res.data;
    },
    enabled: !!periodParams,
  });

  const registers = data?.data ?? data?.registers ?? [];
  const totals = useMemo(() => aggregateRegisters(registers), [registers]);
  const byClass = useMemo(() => aggregateByClass(registers), [registers]);
  const attendanceRate = totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : null;

  const periodLabel = {
    daily: 'Today',
    weekly: 'This Week',
    monthly: 'This Month',
    termly: `${term} ${academicYear}`,
  }[period] ?? '';

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Attendance Summary
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Today</SelectItem>
            <SelectItem value="weekly">This Week</SelectItem>
            <SelectItem value="monthly">This Month</SelectItem>
            <SelectItem value="termly">By Term</SelectItem>
          </SelectContent>
        </Select>

        {period === 'termly' && (
          <>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={academicYear} onValueChange={setAcademicYear}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}

        {classes.length > 1 && (
          <Select value={summaryClass} onValueChange={(v) => setSummaryClass(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}{c.stream ? ` ${c.stream}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : registers.length === 0 ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed text-muted-foreground text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          No submitted attendance records for {periodLabel}.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stat pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill label="Present" value={totals.present} color="bg-green-50 text-green-700" />
            <StatPill label="Absent"  value={totals.absent}  color="bg-red-50 text-red-700" />
            <StatPill label="Late"    value={totals.late}    color="bg-amber-50 text-amber-700" />
            <StatPill label="Excused" value={totals.excused} color="bg-blue-50 text-blue-700" />
          </div>

          {/* Attendance rate bar */}
          {attendanceRate !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Overall attendance rate</span>
                <span className="font-semibold text-foreground">{attendanceRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${attendanceRate >= 80 ? 'bg-green-500' : attendanceRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
            </div>
          )}

          {/* Per-class breakdown (only when showing all classes) */}
          {!summaryClass && byClass.length > 1 && (
            <Card>
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" /> Per Class Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {byClass.map((row) => {
                    const rate = row.total > 0 ? Math.round((row.present / row.total) * 100) : 0;
                    return (
                      <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                        <p className="text-sm font-medium">{row.label}</p>
                        <div className="flex items-center gap-3">
                          <div className="hidden sm:flex gap-2 text-xs text-muted-foreground">
                            <span className="text-green-700">{row.present}P</span>
                            <span className="text-red-700">{row.absent}A</span>
                            {row.late > 0 && <span className="text-amber-700">{row.late}L</span>}
                          </div>
                          <Badge
                            className={`text-xs font-semibold min-w-[3rem] justify-center ${
                              rate >= 80 ? 'bg-green-100 text-green-800' :
                              rate >= 60 ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}
                          >
                            {rate}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}

// ── Today's class register card ───────────────────────────────────────────────
function ClassRegisterCard({ cls, today, onOpen, onTake, isCreating }) {
  const todayReg = today?.find((r) => {
    const regClassId = typeof r.classId === 'object' ? r.classId._id : r.classId;
    return regClassId === cls._id;
  });

  const className = `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}`;
  const studentCount = cls.studentCount ?? 0;

  if (!todayReg) {
    return (
      <Card className="border-dashed hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
        <CardContent className="flex items-center justify-between py-4 px-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <ClipboardCheck className="h-4 w-4 text-slate-400" />
            </div>
            <div>
              <p className="font-medium text-sm">{className}</p>
              <p className="text-xs text-muted-foreground">{studentCount} students · Not taken today</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => onTake(cls._id)}
            disabled={isCreating}
            className="shrink-0"
          >
            Take Attendance
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isSubmitted = todayReg.status === 'submitted';
  const entryCount = todayReg.entries?.length ?? 0;
  const presentCount = todayReg.entries?.filter((e) => e.status === 'present').length ?? 0;

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all ${isSubmitted ? 'bg-green-50/40 border-green-200' : 'bg-amber-50/40 border-amber-200'}`}
      onClick={() => onOpen(todayReg._id)}
    >
      <CardContent className="flex items-center justify-between py-4 px-5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isSubmitted ? 'bg-green-100' : 'bg-amber-100'}`}>
            {isSubmitted
              ? <CheckCircle2 className="h-4 w-4 text-green-600" />
              : <Clock className="h-4 w-4 text-amber-600" />}
          </div>
          <div>
            <p className="font-medium text-sm">{className}</p>
            <p className="text-xs text-muted-foreground">
              {isSubmitted
                ? `Submitted · ${presentCount}/${entryCount} present`
                : `Draft · ${entryCount} entries saved`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSubmitted ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {isSubmitted ? 'Done' : 'In progress'}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Past register row ──────────────────────────────────────────────────────────
function PastRegisterRow({ reg, onOpen }) {
  const cls = reg.classId;
  const className = typeof cls === 'object' ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : '—';
  const isSubmitted = reg.status === 'submitted';
  const presentCount = reg.entries?.filter((e) => e.status === 'present').length ?? 0;
  const totalCount = reg.entries?.length ?? 0;

  return (
    <div
      className="flex items-center justify-between py-3 px-4 hover:bg-muted/40 rounded-lg cursor-pointer transition-colors"
      onClick={() => onOpen(reg._id)}
    >
      <div>
        <p className="text-sm font-medium">{className}</p>
        <p className="text-xs text-muted-foreground">{formatDate(reg.date)} · {reg.term} {reg.academicYear}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground tabular-nums">{presentCount}/{totalCount} present</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSubmitted ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {capitalize(reg.status)}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const adminView = isAdmin(user);

  const [classFilter, setClassFilter] = useState('');

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classesApi.list({ limit: 100 });
      return res.data;
    },
  });

  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: async () => {
      const res = await attendanceApi.listRegisters({ date: TODAY, limit: 100 });
      return res.data;
    },
  });

  const { data: pastData, isLoading: pastLoading } = useQuery({
    queryKey: ['attendance-past', classFilter],
    queryFn: async () => {
      const res = await attendanceApi.listRegisters({
        limit: 20,
        classId: classFilter || undefined,
      });
      return res.data;
    },
  });

  const { mutate: createRegister, isPending: isCreating } = useMutation({
    mutationFn: (classId) =>
      attendanceApi.createRegister({ classId, date: TODAY }),
    onSuccess: (res) => {
      const newId = res.data?.data?._id ?? res.data?.register?._id;
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      if (newId) router.push(`/attendance/${newId}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const classes = classesData?.data ?? classesData?.classes ?? [];
  const todayRegisters = todayData?.data ?? todayData?.registers ?? [];
  const pastRegisters = (pastData?.data ?? pastData?.registers ?? []).filter(
    (r) => {
      const d = typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10);
      return d !== TODAY;
    }
  );

  const todayDone = todayRegisters.filter((r) => r.status === 'submitted').length;
  const todayTotal = classes.length;

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description={`${formatDate(new Date())} · ${todayDone} of ${todayTotal} classes submitted`} />

      {/* ── Today's register grid ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Today&apos;s Attendance
        </h2>

        {todayLoading || !classesData ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed text-muted-foreground text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            No classes found. Add classes first before taking attendance.
          </div>
        ) : (
          <div className="space-y-2">
            {classes.map((cls) => (
              <ClassRegisterCard
                key={cls._id}
                cls={cls}
                today={todayRegisters}
                onOpen={(id) => router.push(`/attendance/${id}`)}
                onTake={(classId) => createRegister(classId)}
                isCreating={isCreating}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Attendance Summary ─────────────────────────────────────────────── */}
      {classes.length > 0 && <AttendanceSummary classes={classes} />}

      {/* ── Past registers ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Previous Registers
          </h2>
          {adminView && classes.length > 0 && (
            <Select value={classFilter} onValueChange={(v) => setClassFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}{c.stream ? ` ${c.stream}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {pastLoading ? (
          <div className="space-y-1">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : pastRegisters.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No previous registers yet.</p>
        ) : (
          <Card>
            <CardContent className="p-2 divide-y">
              {pastRegisters.map((reg) => (
                <PastRegisterRow
                  key={reg._id}
                  reg={reg}
                  onOpen={(id) => router.push(`/attendance/${id}`)}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
