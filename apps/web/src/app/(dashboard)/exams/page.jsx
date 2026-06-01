'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, ChevronRight, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { examsApi, classesApi, subjectsApi, getErrorMessage } from '@/lib/api';
import { capitalize, formatDate } from '@/lib/utils';
import { EXAM_TYPES, ACADEMIC_YEARS, TERMS } from '@/lib/constants';
import { useSchoolTermDefaults } from '@/hooks/use-school-term-defaults';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

const TYPE_LABELS = { opener: 'Opener', midterm: 'Mid Term', endterm: 'End Term', sba: 'SBA' };
const TYPE_COLORS = {
  opener:  'bg-blue-50 text-blue-700 border-blue-200',
  midterm: 'bg-amber-50 text-amber-700 border-amber-200',
  endterm: 'bg-green-50 text-green-700 border-green-200',
  sba:     'bg-purple-50 text-purple-700 border-purple-200',
};

const TERM_ORDER  = ['Term 1', 'Term 2', 'Term 3'];
const TYPE_ORDER  = ['opener', 'midterm', 'endterm', 'sba'];

const schema = z.object({
  name:         z.string().min(1, 'Required'),
  classId:      z.string().min(1, 'Required'),
  subjectId:    z.string().min(1, 'Required'),
  type:         z.string().min(1, 'Required'),
  term:         z.string().min(1, 'Required'),
  academicYear: z.string().min(1, 'Required'),
  totalMarks:   z.coerce.number().positive(),
  examPaperUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
});

// ── Status pill (using type as proxy) ─────────────────────────────────────────
function TypePill({ type }) {
  const colors = TYPE_COLORS[type] ?? 'bg-slate-50 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0 text-[10px] font-medium ${colors}`}>
      {TYPE_LABELS[type] ?? capitalize(type)}
    </span>
  );
}

export default function ExamsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { academicYear: defaultAcademicYear, term: defaultTerm } = useSchoolTermDefaults(['exams', 'term-defaults']);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  const [filterClass, setFilterClass] = useState('');
  const [filterType,  setFilterType]  = useState('');
  const [filterTerm,  setFilterTerm]  = useState('');
  const [filterYear,  setFilterYear]  = useState('');

  const hasFilters = filterClass || filterType || filterTerm || filterYear;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { academicYear: defaultAcademicYear, term: defaultTerm, totalMarks: 100, examPaperUrl: '' },
  });
  const classId         = watch('classId');
  const formAcademicYear = watch('academicYear');
  const formTerm         = watch('term');

  useEffect(() => {
    setValue('academicYear', defaultAcademicYear);
    setValue('term', defaultTerm);
  }, [defaultAcademicYear, defaultTerm, setValue]);

  const { data, isLoading } = useQuery({
    queryKey: ['exams', page, filterClass, filterType, filterTerm, filterYear],
    queryFn: async () => {
      const res = await examsApi.list({
        page, limit: 100,
        classId:      filterClass || undefined,
        type:         filterType  || undefined,
        term:         filterTerm  || undefined,
        academicYear: filterYear  || undefined,
      });
      return res.data;
    },
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classesApi.list({ limit: 100 });
      const d = res.data;
      return Array.isArray(d) ? d : (d?.classes ?? d?.data ?? []);
    },
  });

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects', 'class', classId],
    queryFn: async () => { const res = await subjectsApi.list({ classId, limit: 100 }); return res.data; },
    enabled: !!classId,
  });

  const { mutate: createExam, isPending } = useMutation({
    mutationFn: (d) => examsApi.create({ ...d, examPaperUrl: d.examPaperUrl || undefined }),
    onSuccess: () => {
      toast.success('Exam created');
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      setOpen(false);
      reset({ academicYear: defaultAcademicYear, term: defaultTerm, totalMarks: 100, examPaperUrl: '' });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: deleteExam } = useMutation({
    mutationFn: (id) => examsApi.delete(id),
    onSuccess: () => { toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['exams'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const classes = Array.isArray(classesData) ? classesData : (classesData?.classes ?? classesData?.data ?? []);
  const allExams = data?.data ?? data?.exams ?? [];

  // Group by term → type
  const grouped = useMemo(() => {
    const map = new Map();
    for (const exam of allExams) {
      const t = exam.term ?? 'Unknown';
      const key = `${t}::${exam.type ?? 'other'}`;
      if (!map.has(key)) map.set(key, { term: t, type: exam.type ?? 'other', items: [] });
      map.get(key).items.push(exam);
    }
    return [...map.values()].sort((a, b) => {
      const ti = TERM_ORDER.indexOf(a.term) - TERM_ORDER.indexOf(b.term);
      return ti !== 0 ? ti : TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
    });
  }, [allExams]);

  return (
    <div className="space-y-4">
      <PageHeader title="Exams" description="Configure exams and enter student results">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Create Exam
        </Button>
      </PageHeader>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterClass} onValueChange={(v) => { setFilterClass(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-40 text-xs"><SelectValue placeholder="All classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c._id} value={c._id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={(v) => { setFilterType(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-36 text-xs"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {EXAM_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{TYPE_LABELS[t] ?? capitalize(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTerm} onValueChange={(v) => { setFilterTerm(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-28 text-xs"><SelectValue placeholder="All terms" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All terms</SelectItem>
            {TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterYear} onValueChange={(v) => { setFilterYear(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-24 text-xs"><SelectValue placeholder="All years" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All years</SelectItem>
            {ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9"
            onClick={() => { setFilterClass(''); setFilterType(''); setFilterTerm(''); setFilterYear(''); setPage(1); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Grouped list */}
      {isLoading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground text-sm">
          No exams found. Create your first exam to get started.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ term, type, items }) => (
            <div key={`${term}-${type}`}>
              {/* Group header */}
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{term}</span>
                <TypePill type={type} />
                <span className="text-[10px] text-muted-foreground">{items.length}</span>
              </div>

              {/* Hairline list */}
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="text-left py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Exam</th>
                      <th className="text-left py-2.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Class</th>
                      <th className="text-left py-2.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Subject</th>
                      <th className="text-right py-2.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Marks</th>
                      <th className="text-right py-2.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Year</th>
                      <th className="py-2.5 px-3 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((exam) => {
                      const cls  = typeof exam.classId   === 'object' ? exam.classId  : null;
                      const subj = typeof exam.subjectId === 'object' ? exam.subjectId : null;
                      return (
                        <tr
                          key={exam._id}
                          className="hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={() => router.push(`/exams/${exam._id}`)}
                        >
                          <td className="py-3 px-4">
                            <p className="font-display font-semibold leading-tight">{exam.name}</p>
                            {exam.examPaperUrl && (
                              <span className="text-[10px] text-blue-600 flex items-center gap-1 mt-0.5">
                                <FileText className="h-2.5 w-2.5" /> Paper attached
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground hidden sm:table-cell">
                            {cls ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : '—'}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground hidden md:table-cell">
                            {subj?.name ?? '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-[11px] text-muted-foreground">
                            /{exam.totalMarks}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-[11px] text-muted-foreground hidden sm:table-cell">
                            {exam.academicYear}
                          </td>
                          <td className="py-3 px-3">
                            <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset({ academicYear: defaultAcademicYear, term: defaultTerm, totalMarks: 100, examPaperUrl: '' });
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Exam</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(createExam)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Exam Name <span className="text-destructive">*</span></Label>
              <Input {...register('name')} placeholder="e.g. End Term Mathematics" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Class <span className="text-destructive">*</span></Label>
                <Select onValueChange={(v) => { setValue('classId', v, { shouldValidate: true }); setValue('subjectId', ''); }}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c._id} value={c._id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.classId && <p className="text-xs text-destructive">{errors.classId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Subject <span className="text-destructive">*</span></Label>
                <Select onValueChange={(v) => setValue('subjectId', v, { shouldValidate: true })} disabled={!classId}>
                  <SelectTrigger><SelectValue placeholder={classId ? 'Select' : 'Pick class first'} /></SelectTrigger>
                  <SelectContent>
                    {(subjectsData?.data ?? []).map((s) => (
                      <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.subjectId && <p className="text-xs text-destructive">{errors.subjectId.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Exam Type <span className="text-destructive">*</span></Label>
                <Select onValueChange={(v) => setValue('type', v, { shouldValidate: true })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {EXAM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t] ?? capitalize(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Total Marks <span className="text-destructive">*</span></Label>
                <Input {...register('totalMarks')} type="number" min={1} />
                {errors.totalMarks && <p className="text-xs text-destructive">{errors.totalMarks.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Term</Label>
                <Select value={formTerm || defaultTerm} onValueChange={(v) => setValue('term', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Academic Year</Label>
                <Select value={formAcademicYear || defaultAcademicYear} onValueChange={(v) => setValue('academicYear', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Exam Paper URL
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </Label>
              <Input {...register('examPaperUrl')} placeholder="https://drive.google.com/..." type="url" />
              {errors.examPaperUrl && <p className="text-xs text-destructive">{errors.examPaperUrl.message}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setOpen(false);
                reset({ academicYear: defaultAcademicYear, term: defaultTerm, totalMarks: 100, examPaperUrl: '' });
              }}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Exam'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
