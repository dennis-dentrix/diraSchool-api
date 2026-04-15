'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { resultsApi, classesApi, examsApi, studentsApi, getErrorMessage } from '@/lib/api';
import { ACADEMIC_YEARS, TERMS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export default function ResultsPage() {
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [marks, setMarks] = useState({});

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classesApi.list({ limit: 100 });
      return res.data;
    },
  });

  const { data: examsData } = useQuery({
    queryKey: ['exams', selectedClass],
    queryFn: async () => {
      const res = await examsApi.list({ classId: selectedClass, limit: 100 });
      return res.data;
    },
    enabled: !!selectedClass,
  });

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', 'class', selectedClass],
    queryFn: async () => {
      const res = await studentsApi.list({ classId: selectedClass, status: 'active', limit: 200 });
      return res.data;
    },
    enabled: !!selectedClass,
  });

  const { data: existingResults } = useQuery({
    queryKey: ['results', selectedExam],
    queryFn: async () => {
      const res = await resultsApi.list({ examId: selectedExam, limit: 200 });
      return res.data;
    },
    enabled: !!selectedExam,
    onSuccess: (data) => {
      const m = {};
      data?.data?.forEach((r) => { m[r.studentId?._id ?? r.studentId] = r.marks; });
      setMarks(m);
    },
  });

  const { mutate: saveBulk, isPending } = useMutation({
    mutationFn: () => {
      const exam = examsData?.data?.find((e) => e._id === selectedExam);
      const entries = studentsData?.data?.map((s) => ({
        studentId: s._id,
        marks: Number(marks[s._id] ?? 0),
      }));
      return resultsApi.bulkUpsert({ examId: selectedExam, classId: selectedClass, entries });
    },
    onSuccess: () => {
      toast.success('Results saved');
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const students = studentsData?.data ?? [];
  const selectedExamObj = examsData?.data?.find((e) => e._id === selectedExam);

  return (
    <div>
      <PageHeader title="Exam Results" description="Enter and manage student marks">
        {selectedExam && students.length > 0 && (
          <Button size="sm" onClick={() => saveBulk()} disabled={isPending}>
            <Save className="h-4 w-4" /> Save Results
          </Button>
        )}
      </PageHeader>

      <Card className="mb-6">
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Select Class</Label>
              <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedExam(''); setMarks({}); }}>
                <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
                <SelectContent>
                  {classesData?.data?.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Select Exam</Label>
              <Select value={selectedExam} onValueChange={(v) => { setSelectedExam(v); setMarks({}); }} disabled={!selectedClass}>
                <SelectTrigger><SelectValue placeholder="Choose exam" /></SelectTrigger>
                <SelectContent>
                  {examsData?.data?.map((e) => (
                    <SelectItem key={e._id} value={e._id}>
                      {e.name} — {typeof e.subjectId === 'object' ? e.subjectId.name : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedExam && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedExamObj?.name} — Out of {selectedExamObj?.totalMarks ?? 100}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentsLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : students.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No active students in this class.</p>
            ) : (
              <div className="space-y-2">
                {students.map((student) => (
                  <div key={student._id} className="flex items-center gap-4 py-2 border-b last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{student.firstName} {student.lastName}</p>
                      <p className="text-xs text-muted-foreground">{student.admissionNumber}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max={selectedExamObj?.totalMarks ?? 100}
                        className="w-24 h-8 text-center"
                        value={marks[student._id] ?? ''}
                        onChange={(e) => setMarks((prev) => ({ ...prev, [student._id]: e.target.value }))}
                        placeholder="—"
                      />
                      <span className="text-xs text-muted-foreground">/ {selectedExamObj?.totalMarks ?? 100}</span>
                    </div>
                  </div>
                ))}
                <div className="pt-3 flex justify-end">
                  <Button onClick={() => saveBulk()} disabled={isPending}>
                    <Save className="h-4 w-4" /> Save All Results
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
