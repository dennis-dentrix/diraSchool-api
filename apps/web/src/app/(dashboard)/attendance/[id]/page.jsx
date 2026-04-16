'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { attendanceApi, getErrorMessage } from '@/lib/api';
import { formatDate, capitalize } from '@/lib/utils';
import { ATTENDANCE_STATUSES } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const statusColors = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  late: 'bg-yellow-100 text-yellow-700',
  excused: 'bg-blue-100 text-blue-700',
};

export default function AttendanceRegisterPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-register', id],
    queryFn: async () => {
      const res = await attendanceApi.getRegister(id);
      return res.data.data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (data?.entries) setEntries(data.entries.map((e) => ({ ...e })));
  }, [data]);

  const isLocked = data?.status === 'submitted';

  const { mutate: saveEntries, isPending: saving } = useMutation({
    mutationFn: () => attendanceApi.updateRegister(id, { entries }),
    onSuccess: () => {
      toast.success('Saved');
      queryClient.invalidateQueries({ queryKey: ['attendance-register', id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: submitRegister, isPending: submitting } = useMutation({
    mutationFn: () => attendanceApi.submitRegister(id),
    onSuccess: () => {
      toast.success('Register submitted and locked');
      queryClient.invalidateQueries({ queryKey: ['attendance-register', id] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateEntry = (studentId, status) => {
    setEntries((prev) => prev.map((e) =>
      (e.studentId?._id ?? e.studentId) === studentId ? { ...e, status } : e,
    ));
  };

  const markAll = (status) => {
    setEntries((prev) => prev.map((e) => ({ ...e, status })));
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  const cls = data?.classId;
  const className = typeof cls === 'object' ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : 'Class';

  return (
    <div>
      <PageHeader
        title={`${className} — Attendance`}
        description={`${formatDate(data?.date)} · ${data?.term} · ${data?.academicYear}`}
      >
        {isLocked ? (
          <Badge variant="success" className="bg-green-100 text-green-800">Submitted</Badge>
        ) : (
          <>
            <div className="flex gap-1">
              {ATTENDANCE_STATUSES.map((s) => (
                <Button key={s} size="sm" variant="outline" className={`text-xs ${statusColors[s]}`} onClick={() => markAll(s)}>
                  All {capitalize(s)}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => saveEntries()} disabled={saving}>
              <Save className="h-4 w-4" /> Save
            </Button>
            <Button size="sm" onClick={() => { if (confirm('Submit and lock this register?')) submitRegister(); }} disabled={submitting}>
              <CheckCircle className="h-4 w-4" /> Submit
            </Button>
          </>
        )}
      </PageHeader>

      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No students in this register.</p>
        ) : entries.map((entry) => {
          const student = entry.studentId;
          const studentId = typeof student === 'object' ? student._id : student;
          return (
            <Card key={studentId}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {typeof student === 'object' ? `${student.firstName} ${student.lastName}` : `Student ${studentId}`}
                  </p>
                  {typeof student === 'object' && (
                    <p className="text-xs text-muted-foreground">{student.admissionNumber}</p>
                  )}
                </div>
                {isLocked ? (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[entry.status]}`}>
                    {capitalize(entry.status)}
                  </span>
                ) : (
                  <Select value={entry.status} onValueChange={(v) => updateEntry(studentId, v)}>
                    <SelectTrigger className={`w-32 h-8 text-xs font-medium ${statusColors[entry.status]}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
