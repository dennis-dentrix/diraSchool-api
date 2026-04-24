'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Printer,
  CheckCircle,
  Pencil,
  RefreshCw,
  FileDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { reportCardsApi, settingsApi, schoolsApi, getErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ── Grade colour map ──────────────────────────────────────────────────────────

const gradeColors = {
  EE:  'bg-green-100 text-green-800',
  ME:  'bg-blue-100 text-blue-800',
  AE:  'bg-yellow-100 text-yellow-800',
  BE:  'bg-red-100 text-red-800',
  EE1: 'bg-green-100 text-green-800',
  EE2: 'bg-green-100 text-green-800',
  ME1: 'bg-blue-100 text-blue-800',
  ME2: 'bg-blue-100 text-blue-800',
  AE1: 'bg-yellow-100 text-yellow-800',
  AE2: 'bg-yellow-100 text-yellow-800',
  BE1: 'bg-red-100 text-red-800',
  BE2: 'bg-red-100 text-red-800',
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? '—'}</p>
    </div>
  );
}

// ── PDF status card ───────────────────────────────────────────────────────────
// Shows the right UI for every pdfStatus value and handles its own mutation so
// the parent component stays clean.

function PdfStatusCard({ rc, reportCardId }) {
  const queryClient = useQueryClient();
  const { pdfStatus, pdfUrl, pdfError, pdfGeneratedAt } = rc;

  const { mutate: requestPdf, isPending } = useMutation({
    mutationFn: () => reportCardsApi.generatePdf(reportCardId),
    onSuccess: () => {
      toast.success('PDF generation queued — you\'ll be notified when it\'s ready.');
      queryClient.invalidateQueries({ queryKey: ['report-card', reportCardId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Generating
  if (pdfStatus === 'queued' || pdfStatus === 'processing') {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Generating PDF…</p>
            <p className="text-xs text-muted-foreground">
              Usually takes 10–30 seconds. You'll receive a notification when it's ready.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ready
  if (pdfStatus === 'ready' && pdfUrl) {
    return (
      <Card className="border-green-200 bg-green-50/40 dark:bg-green-950/20">
        <CardContent className="flex items-center justify-between gap-4 py-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <FileDown className="h-5 w-5 text-green-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-900 dark:text-green-200">PDF Ready</p>
              {pdfGeneratedAt && (
                <p className="text-xs text-muted-foreground">
                  Generated {formatDate(pdfGeneratedAt)}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => requestPdf()}
              disabled={isPending}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Regenerate
            </Button>
            <Button size="sm" asChild>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <FileDown className="h-4 w-4 mr-1.5" />
                Download PDF
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Failed
  if (pdfStatus === 'failed') {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center justify-between gap-4 py-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-destructive">PDF Generation Failed</p>
              {pdfError && (
                <p className="text-xs text-muted-foreground truncate max-w-sm">{pdfError}</p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => requestPdf()}
            disabled={isPending}
            className="shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            {isPending ? 'Queueing…' : 'Retry'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // not_requested (default) — prompt admin to generate
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <FileDown className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">PDF not generated</p>
            <p className="text-xs text-muted-foreground">
              Generate a downloadable PDF to share with parents.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => requestPdf()}
          disabled={isPending}
          className="shrink-0"
        >
          <FileDown className="h-4 w-4 mr-1.5" />
          {isPending ? 'Queueing…' : 'Generate PDF'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportCardDetailPage() {
  const params  = useParams();
  const id      = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const router  = useRouter();
  const queryClient = useQueryClient();

  const [editing,                setEditing]                = useState(false);
  const [publishConfirmOpen,     setPublishConfirmOpen]     = useState(false);
  const [regenerateConfirmOpen,  setRegenerateConfirmOpen]  = useState(false);
  const [remarks, setRemarks] = useState({ teacherRemarks: '', principalRemarks: '' });
  const [subjectRemarks,         setSubjectRemarks]         = useState({});
  const [savingSubject,          setSavingSubject]          = useState(null);

  // Poll every 5 s while the PDF worker is running so the status card updates
  // automatically without the user needing to refresh.
  const { data: rc, isLoading } = useQuery({
    queryKey: ['report-card', id],
    queryFn: async () => {
      const res  = await reportCardsApi.get(id);
      const card = res.data?.reportCard ?? res.data?.data ?? res.data;
      setRemarks({
        teacherRemarks:   card?.teacherRemarks   ?? '',
        principalRemarks: card?.principalRemarks ?? '',
      });
      const subjMap = {};
      (card?.subjects ?? []).forEach((s) => {
        subjMap[s.subjectId?.toString() ?? s.subjectName] = s.teacherRemark ?? '';
      });
      setSubjectRemarks(subjMap);
      return card;
    },
    enabled: !!id,
    // Auto-poll while the worker is processing; stop once done.
    refetchInterval: (query) => {
      const status = query.state.data?.pdfStatus;
      return status === 'queued' || status === 'processing' ? 5_000 : false;
    },
  });

  const { data: school } = useQuery({
    queryKey: ['school-me'],
    queryFn: async () => {
      const res = await schoolsApi.me();
      return res.data?.school ?? res.data?.data ?? res.data;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await settingsApi.get();
      return res.data?.settings ?? res.data?.data ?? res.data;
    },
  });

  const { mutate: saveRemarks, isPending: savingRemarks } = useMutation({
    mutationFn: () =>
      reportCardsApi.updateRemarks(id, {
        teacherRemarks:   remarks.teacherRemarks   || undefined,
        principalRemarks: remarks.principalRemarks || undefined,
      }),
    onSuccess: () => {
      toast.success('Remarks saved');
      queryClient.invalidateQueries({ queryKey: ['report-card', id] });
      setEditing(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: publish, isPending: publishing } = useMutation({
    mutationFn: () => reportCardsApi.publish(id),
    onSuccess: () => {
      toast.success('Report card published');
      queryClient.invalidateQueries({ queryKey: ['report-card', id] });
      queryClient.invalidateQueries({ queryKey: ['report-cards'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: regenerate, isPending: regenerating } = useMutation({
    mutationFn: () =>
      reportCardsApi.generate({
        studentId:    typeof rc?.studentId === 'object' ? rc.studentId._id : rc?.studentId,
        academicYear: rc?.academicYear,
        term:         rc?.term,
      }),
    onSuccess: () => {
      toast.success('Report card regenerated with latest results');
      queryClient.invalidateQueries({ queryKey: ['report-card', id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  async function saveSubjectRemark(subjectId, remark) {
    setSavingSubject(subjectId);
    try {
      await reportCardsApi.updateSubjectRemark(id, subjectId, { remark });
      toast.success('Subject remark saved');
      queryClient.invalidateQueries({ queryKey: ['report-card', id] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingSubject(null);
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!rc) {
    return <p className="text-muted-foreground">Report card not found.</p>;
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const student        = rc.studentId;
  const cls            = rc.classId;
  const isDraft        = rc.status === 'draft';
  const documentSerial = rc.documentSerial
    ?? `RPT-${rc.academicYear}-${String(rc._id).slice(-6).toUpperCase()}`;

  // eslint-disable-next-line no-unused-vars
  const principalName = settings?.principalName ?? school?.principalName ?? '';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">
            {typeof student === 'object'
              ? `${student.firstName} ${student.lastName}`
              : 'Report Card'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {cls?.name}{cls?.stream ? ` ${cls.stream}` : ''} · {rc.term} · {rc.academicYear}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Badge className={isDraft ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
            {isDraft ? 'Draft' : 'Published'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/report-cards/${id}/print`, '_blank')}
          >
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          {isDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRegenerateConfirmOpen(true)}
              disabled={regenerating}
              title="Re-pulls all exam results and rebuilds subject grades. Remarks are kept."
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </Button>
          )}
          {isDraft && (
            <Button
              size="sm"
              onClick={() => setPublishConfirmOpen(true)}
              disabled={publishing}
            >
              <CheckCircle className="h-4 w-4 mr-1" /> Publish
            </Button>
          )}
        </div>
      </div>

      {/* ── PDF status ───────────────────────────────────────────────────── */}
      <PdfStatusCard rc={rc} reportCardId={id} />

      {/* ── Student info ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Student Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          {typeof student === 'object' && (
            <div className="flex items-center gap-3 mb-4">
              {student.photo ? (
                <img
                  src={student.photo}
                  alt={`${student.firstName} ${student.lastName}`}
                  className="w-16 h-16 rounded-full object-cover border"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 text-lg font-bold flex items-center justify-center">
                  {student.firstName?.[0]}{student.lastName?.[0]}
                </div>
              )}
              <div>
                <p className="text-base font-semibold">
                  {student.firstName} {student.lastName}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {student.admissionNumber}
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <InfoItem
              label="Full Name"
              value={typeof student === 'object'
                ? `${student.firstName} ${student.lastName}`
                : '—'}
            />
            <InfoItem
              label="Admission No."
              value={typeof student === 'object' ? student.admissionNumber : '—'}
            />
            <InfoItem
              label="Class"
              value={cls ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : '—'}
            />
            <InfoItem label="Gender"        value={typeof student === 'object' ? student.gender : '—'} />
            <InfoItem label="Academic Year" value={rc.academicYear} />
            <InfoItem label="Term"          value={rc.term} />
            <InfoItem label="Document Serial" value={documentSerial} />
            <InfoItem label="Overall Grade"   value={rc.overallGrade ?? '—'} />
            <InfoItem label="Average Points"  value={rc.averagePoints?.toFixed(2) ?? '—'} />
          </div>
        </CardContent>
      </Card>

      {/* ── Attendance summary ────────────────────────────────────────────── */}
      {rc.attendanceSummary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Attendance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3 text-center">
              {[
                { label: 'Total Days', value: rc.attendanceSummary.totalDays },
                { label: 'Present',    value: rc.attendanceSummary.present },
                { label: 'Absent',     value: rc.attendanceSummary.absent },
                { label: 'Late',       value: rc.attendanceSummary.late },
                { label: 'Excused',    value: rc.attendanceSummary.excused },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/40 rounded-lg py-3">
                  <p className="text-xl font-bold">{value ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Subject performance ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Subject Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Subject</th>
                  <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Avg %</th>
                  <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Grade</th>
                  <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Points</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">
                    Teacher Remark
                    {isDraft && (
                      <span className="text-xs font-normal ml-1 text-muted-foreground">
                        (editable)
                      </span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(rc.subjects ?? []).map((subject) => {
                  const subKey = subject.subjectId?.toString() ?? subject.subjectName;
                  return (
                    <tr key={subKey} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium">
                        {subject.subjectName}
                        {subject.subjectCode && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({subject.subjectCode})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center tabular-nums">
                        {subject.averagePercentage?.toFixed(1) ?? '—'}%
                      </td>
                      <td className="py-3 px-3 text-center">
                        {subject.grade ? (
                          <Badge
                            className={`text-xs ${gradeColors[subject.grade] ?? 'bg-gray-100 text-gray-800'}`}
                          >
                            {subject.grade}
                          </Badge>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold tabular-nums">
                        {subject.points ?? '—'}
                      </td>
                      <td className="py-3 px-4">
                        {isDraft ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="text"
                              placeholder="Add remark…"
                              value={subjectRemarks[subKey] ?? ''}
                              onChange={(e) =>
                                setSubjectRemarks((p) => ({ ...p, [subKey]: e.target.value }))
                              }
                              className="flex-1 text-xs border border-input rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring min-w-0"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2 shrink-0"
                              disabled={savingSubject === subKey}
                              onClick={() => saveSubjectRemark(subKey, subjectRemarks[subKey])}
                            >
                              Save
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {subject.teacherRemark ?? '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td className="py-2.5 px-4 font-semibold">Overall</td>
                  <td className="py-2.5 px-3 text-center tabular-nums font-semibold">—</td>
                  <td className="py-2.5 px-3 text-center">
                    {rc.overallGrade ? (
                      <Badge
                        className={gradeColors[rc.overallGrade] ?? 'bg-gray-100 text-gray-800'}
                      >
                        {rc.overallGrade}
                      </Badge>
                    ) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold tabular-nums">
                    {rc.averagePoints?.toFixed(2) ?? '—'}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Remarks ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Remarks
          </CardTitle>
          {isDraft && !editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <>
              <div className="space-y-1.5">
                <Label>Class Teacher&apos;s Remarks</Label>
                <Textarea
                  rows={3}
                  value={remarks.teacherRemarks}
                  onChange={(e) =>
                    setRemarks((p) => ({ ...p, teacherRemarks: e.target.value }))
                  }
                  placeholder="Enter class teacher's remarks…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Principal&apos;s Remarks</Label>
                <Textarea
                  rows={3}
                  value={remarks.principalRemarks}
                  onChange={(e) =>
                    setRemarks((p) => ({ ...p, principalRemarks: e.target.value }))
                  }
                  placeholder="Enter principal's remarks…"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveRemarks()} disabled={savingRemarks}>
                  Save Remarks
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setRemarks({
                      teacherRemarks:   rc.teacherRemarks   ?? '',
                      principalRemarks: rc.principalRemarks ?? '',
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Class Teacher&apos;s Remarks
                </p>
                <p className="text-sm">
                  {rc.teacherRemarks || (
                    <span className="text-muted-foreground italic">No remarks added.</span>
                  )}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Principal&apos;s Remarks</p>
                <p className="text-sm">
                  {rc.principalRemarks || (
                    <span className="text-muted-foreground italic">No remarks added.</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Exam breakdown ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Exam Breakdown by Subject
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(rc.subjects ?? []).map((subject) => (
            <div
              key={subject.subjectId?.toString() ?? subject.subjectName}
              className="border-b last:border-0"
            >
              <div className="px-4 py-2 bg-muted/20">
                <span className="text-sm font-semibold">{subject.subjectName}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left px-4 py-1.5 font-medium">Exam</th>
                      <th className="text-left px-3 py-1.5 font-medium">Type</th>
                      <th className="text-center px-3 py-1.5 font-medium">Marks</th>
                      <th className="text-center px-3 py-1.5 font-medium">Out of</th>
                      <th className="text-center px-3 py-1.5 font-medium">%</th>
                      <th className="text-center px-3 py-1.5 font-medium">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(subject.exams ?? []).map((exam) => (
                      <tr key={exam.examId?.toString()} className="hover:bg-muted/10">
                        <td className="px-4 py-1.5">{exam.examName}</td>
                        <td className="px-3 py-1.5 capitalize text-muted-foreground">
                          {exam.examType}
                        </td>
                        <td className="px-3 py-1.5 text-center tabular-nums">{exam.marks}</td>
                        <td className="px-3 py-1.5 text-center tabular-nums text-muted-foreground">
                          {exam.totalMarks}
                        </td>
                        <td className="px-3 py-1.5 text-center tabular-nums">
                          {exam.percentage?.toFixed(1)}%
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {exam.grade ? (
                            <Badge
                              className={`text-xs ${gradeColors[exam.grade] ?? 'bg-gray-100 text-gray-800'}`}
                            >
                              {exam.grade}
                            </Badge>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Confirm dialogs ───────────────────────────────────────────────── */}
      <AlertDialog open={regenerateConfirmOpen} onOpenChange={setRegenerateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Report Card?</AlertDialogTitle>
            <AlertDialogDescription>
              This rebuilds the report card using the latest results. Existing remarks will be
              preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => regenerate()} disabled={regenerating}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Report Card?</AlertDialogTitle>
            <AlertDialogDescription>
              Once published, this report card can no longer be edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => publish()} disabled={publishing}>
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
