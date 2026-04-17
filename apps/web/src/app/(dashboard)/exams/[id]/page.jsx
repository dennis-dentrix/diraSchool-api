'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, Save, CheckCircle, BookOpen } from 'lucide-react';
import { examsApi, resultsApi, studentsApi, getErrorMessage } from '@/lib/api';
import { capitalize } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// CBC grade label derived from percentage
function cbcGrade(marks, total, isJSS) {
  if (!marks && marks !== 0) return null;
  const p = Math.round((marks / total) * 100);
  if (isJSS) {
    if (p >= 90) return { label: 'EE1', color: 'bg-green-100 text-green-800' };
    if (p >= 75) return { label: 'EE2', color: 'bg-green-100 text-green-800' };
    if (p >= 58) return { label: 'ME1', color: 'bg-blue-100 text-blue-800' };
    if (p >= 41) return { label: 'ME2', color: 'bg-blue-100 text-blue-800' };
    if (p >= 31) return { label: 'AE1', color: 'bg-yellow-100 text-yellow-800' };
    if (p >= 21) return { label: 'AE2', color: 'bg-yellow-100 text-yellow-800' };
    if (p >= 11) return { label: 'BE1', color: 'bg-red-100 text-red-800' };
    return { label: 'BE2', color: 'bg-red-100 text-red-800' };
  } else {
    if (p >= 75) return { label: 'EE', color: 'bg-green-100 text-green-800' };
    if (p >= 50) return { label: 'ME', color: 'bg-blue-100 text-blue-800' };
    if (p >= 25) return { label: 'AE', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'BE', color: 'bg-red-100 text-red-800' };
  }
}

export default function ExamResultsPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [scores, setScores] = useState({}); // studentId → marks string

  // Load exam
  const { data: examData, isLoading: examLoading } = useQuery({
    queryKey: ['exam', id],
    queryFn: async () => {
      const res = await examsApi.get(id);
      return res.data?.exam ?? res.data?.data ?? res.data;
    },
    enabled: !!id,
  });

  // Load students for the class
  const classId = examData?.classId?._id ?? examData?.classId;
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', 'class', classId],
    queryFn: async () => {
      const res = await studentsApi.list({ classId, limit: 100, status: 'active' });
      return res.data?.students ?? res.data?.data ?? res.data ?? [];
    },
    enabled: !!classId,
  });

  // Load existing results
  const { data: existingResults } = useQuery({
    queryKey: ['results', 'exam', id],
    queryFn: async () => {
      const res = await resultsApi.list({ examId: id, limit: 200 });
      return res.data?.results ?? res.data?.data ?? res.data ?? [];
    },
    enabled: !!id,
  });

  // Pre-fill scores from existing results
  useEffect(() => {
    if (!existingResults?.length) return;
    const map = {};
    const resultsArr = Array.isArray(existingResults) ? existingResults : [];
    for (const r of resultsArr) {
      const sid = typeof r.studentId === 'object' ? r.studentId._id : r.studentId;
      map[sid] = String(r.marks ?? '');
    }
    setScores(map);
  }, [existingResults]);

  const { mutate: saveResults, isPending: saving } = useMutation({
    mutationFn: () => {
      const students = Array.isArray(studentsData) ? studentsData : [];
      const entries = students
        .filter((s) => scores[s._id] !== '' && scores[s._id] !== undefined)
        .map((s) => ({ studentId: s._id, marks: Number(scores[s._id]) }));
      if (!entries.length) throw new Error('Enter at least one mark to save.');
      return resultsApi.bulkUpsert({ examId: id, classId, entries });
    },
    onSuccess: () => {
      toast.success('Results saved');
      queryClient.invalidateQueries({ queryKey: ['results', 'exam', id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const isLoading = examLoading || studentsLoading;
  const exam = examData;
  const students = Array.isArray(studentsData) ? studentsData : [];
  const isJSS = exam?.levelCategory === 'Junior Secondary';
  const total = exam?.totalMarks ?? 100;

  const filled = Object.values(scores).filter((v) => v !== '' && v !== undefined).length;
  const avgPct = filled > 0
    ? Math.round(students.filter((s) => scores[s._id] !== '' && scores[s._id] !== undefined)
        .reduce((sum, s) => sum + Number(scores[s._id]), 0) / filled / total * 100)
    : null;

  if (isLoading) return (
    <div className="space-y-3 max-w-2xl mx-auto">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-4 w-72" />
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
    </div>
  );

  const clsName = typeof exam?.classId === 'object'
    ? `${exam.classId.name}${exam.classId.stream ? ` ${exam.classId.stream}` : ''}`
    : '—';
  const subjName = typeof exam?.subjectId === 'object' ? exam.subjectId.name : '—';

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/exams')} className="mt-1 p-1 rounded-md hover:bg-muted text-muted-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold leading-tight">{exam?.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{clsName} · {subjName} · {exam?.term} {exam?.academicYear}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize">{exam?.type}</Badge>
          <Badge variant="secondary" className="text-xs">out of {total}</Badge>
        </div>
      </div>

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold">{students.length}</p>
            <p className="text-xs text-muted-foreground">Students</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold">{filled}</p>
            <p className="text-xs text-muted-foreground">Entered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold">{avgPct !== null ? `${avgPct}%` : '—'}</p>
            <p className="text-xs text-muted-foreground">Class Avg</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────────── */}
      {students.length > 0 && (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{filled}/{students.length} entered</span>
            <span>{Math.round(filled / students.length * 100)}% complete</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.round(filled / students.length * 100)}%` }} />
          </div>
        </div>
      )}

      {/* ── Student list ─────────────────────────────────────────────────────── */}
      {students.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No students found in this class.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {students.map((student, idx) => {
            const val = scores[student._id] ?? '';
            const grade = val !== '' ? cbcGrade(Number(val), total, isJSS) : null;
            const isOver = val !== '' && Number(val) > total;

            return (
              <div key={student._id} className="flex items-center gap-3 bg-white rounded-xl border px-4 py-3">
                <span className="text-xs text-muted-foreground w-5 text-right shrink-0 tabular-nums">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{student.firstName} {student.lastName}</p>
                  <p className="text-xs text-muted-foreground">{student.admissionNumber}</p>
                </div>
                {grade && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold shrink-0', grade.color)}>
                    {grade.label}
                  </span>
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    type="number"
                    min={0}
                    max={total}
                    placeholder="—"
                    value={val}
                    onChange={(e) => setScores((p) => ({ ...p, [student._id]: e.target.value }))}
                    className={cn(
                      'w-20 h-9 text-center font-medium tabular-nums',
                      isOver && 'border-red-400 focus-visible:ring-red-400'
                    )}
                  />
                  <span className="text-xs text-muted-foreground">/{total}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Save bar ─────────────────────────────────────────────────────────── */}
      {students.length > 0 && (
        <div className="sticky bottom-4 flex justify-end gap-2 pt-2">
          <Button
            onClick={() => saveResults()}
            disabled={saving || filled === 0}
            className="shadow-lg"
          >
            {exam?.isPublished
              ? <><CheckCircle className="h-4 w-4 mr-1.5" />{saving ? 'Saving…' : 'Save Results'}</>
              : <><Save className="h-4 w-4 mr-1.5" />{saving ? 'Saving…' : 'Save Results'}</>
            }
          </Button>
        </div>
      )}
    </div>
  );
}
