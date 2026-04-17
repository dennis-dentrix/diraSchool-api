'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardCheck, ChevronRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { attendanceApi, classesApi, getErrorMessage } from '@/lib/api';
import { formatDate, capitalize } from '@/lib/utils';
import { useAuthStore, isAdmin } from '@/store/auth.store';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

const TODAY = new Date().toISOString().split('T')[0];

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

  // All classes for this school (admin) or just own class (teacher - handled by API)
  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classesApi.list({ limit: 100 });
      return res.data;
    },
  });

  // Today's registers — used to show status per class
  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: async () => {
      const res = await attendanceApi.listRegisters({ date: TODAY, limit: 100 });
      return res.data;
    },
  });

  // Recent past registers (paginated)
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
      // exclude today's from the "past" list to avoid duplicates
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
