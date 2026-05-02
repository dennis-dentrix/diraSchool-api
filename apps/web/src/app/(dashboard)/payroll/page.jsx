'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, CheckCircle2, DollarSign, Users,
  ChevronDown, ChevronRight, Loader2, AlertTriangle, Receipt,
} from 'lucide-react';
import { payrollApi, getErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { PageHeader } from '@/components/shared/page-header';
import { RefreshButton } from '@/components/shared/refresh-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// ── Roles ──────────────────────────────────────────────────────────────────────
const APPROVE_ROLES = ['school_admin', 'director', 'headteacher'];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_MAP = {
  draft:    { label: 'Draft',    className: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  paid:     { label: 'Paid',     className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.className}`}>{cfg.label}</span>;
}

// ── Salary Grades Tab ─────────────────────────────────────────────────────────

function emptyGrade() {
  return { name: '', basicSalary: '', houseAllowance: '', transportAllowance: '', medicalAllowance: '', otherAllowances: '' };
}

function GradesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create mode
  const [form, setForm] = useState(emptyGrade());
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-grades'],
    queryFn: async () => { const r = await payrollApi.listGrades(); return r.data?.salaryGrades ?? []; },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['payroll-grades'] });

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (vals) => editing
      ? payrollApi.updateGrade(editing._id, vals)
      : payrollApi.createGrade(vals),
    onSuccess: () => { toast.success(editing ? 'Grade updated' : 'Grade created'); invalidate(); closeDialog(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: (id) => payrollApi.deleteGrade(id),
    onSuccess: () => { toast.success('Grade deleted'); invalidate(); setDeleteTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openCreate = () => { setEditing(null); setForm(emptyGrade()); setDialogOpen(true); };
  const openEdit   = (g)  => { setEditing(g); setForm({ name: g.name, basicSalary: g.basicSalary, houseAllowance: g.houseAllowance, transportAllowance: g.transportAllowance, medicalAllowance: g.medicalAllowance, otherAllowances: g.otherAllowances }); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const handleSave = () => {
    const vals = {
      name: form.name.trim(),
      basicSalary: Number(form.basicSalary) || 0,
      houseAllowance: Number(form.houseAllowance) || 0,
      transportAllowance: Number(form.transportAllowance) || 0,
      medicalAllowance: Number(form.medicalAllowance) || 0,
      otherAllowances: Number(form.otherAllowances) || 0,
    };
    if (!vals.name) return toast.error('Grade name is required');
    save(vals);
  };

  const grades = data ?? [];
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> New Grade</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : grades.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No salary grades yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {grades.map((g) => {
            const gross = g.basicSalary + g.houseAllowance + g.transportAllowance + g.medicalAllowance + g.otherAllowances;
            return (
              <Card key={g._id} className="border-border/70">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-900">{g.name}</p>
                      <p className="text-xs text-muted-foreground">Gross: {formatCurrency(gross)}/month</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(g)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex justify-between"><span>Basic salary</span><span className="font-medium">{formatCurrency(g.basicSalary)}</span></div>
                    {g.houseAllowance > 0      && <div className="flex justify-between"><span>House allowance</span><span>{formatCurrency(g.houseAllowance)}</span></div>}
                    {g.transportAllowance > 0  && <div className="flex justify-between"><span>Transport</span><span>{formatCurrency(g.transportAllowance)}</span></div>}
                    {g.medicalAllowance > 0    && <div className="flex justify-between"><span>Medical</span><span>{formatCurrency(g.medicalAllowance)}</span></div>}
                    {g.otherAllowances > 0     && <div className="flex justify-between"><span>Other allowances</span><span>{formatCurrency(g.otherAllowances)}</span></div>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Salary Grade' : 'New Salary Grade'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="grade-name">Grade Name</Label>
              <Input id="grade-name" value={form.name} onChange={f('name')} placeholder="e.g. Grade 5 / Senior Teacher" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="grade-basic">Basic Salary (KES)</Label>
                <Input id="grade-basic" type="number" min="0" value={form.basicSalary} onChange={f('basicSalary')} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grade-house">House Allowance</Label>
                <Input id="grade-house" type="number" min="0" value={form.houseAllowance} onChange={f('houseAllowance')} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grade-transport">Transport</Label>
                <Input id="grade-transport" type="number" min="0" value={form.transportAllowance} onChange={f('transportAllowance')} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grade-medical">Medical</Label>
                <Input id="grade-medical" type="number" min="0" value={form.medicalAllowance} onChange={f('medicalAllowance')} placeholder="0" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="grade-other">Other Allowances</Label>
                <Input id="grade-other" type="number" min="0" value={form.otherAllowances} onChange={f('otherAllowances')} placeholder="0" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button disabled={saving} onClick={handleSave}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Save Changes' : 'Create Grade'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Salary Grade</DialogTitle>
            <DialogDescription>This will permanently remove <strong>{deleteTarget?.name}</strong>. Existing payroll runs will not be affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={() => remove(deleteTarget._id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Payroll Runs Tab ──────────────────────────────────────────────────────────

function RunsTab({ canApprove }) {
  const queryClient = useQueryClient();
  const now = new Date();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genMonth, setGenMonth] = useState(String(now.getMonth() + 1));
  const [genYear,  setGenYear]  = useState(String(now.getFullYear()));
  const [expandedRun, setExpandedRun] = useState(null);

  const { data: runsData, isLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: async () => { const r = await payrollApi.listRuns(); return r.data?.runs ?? []; },
  });

  const { data: runDetail } = useQuery({
    queryKey: ['payroll-run', expandedRun],
    queryFn: async () => { const r = await payrollApi.getRun(expandedRun); return r.data?.run ?? null; },
    enabled: !!expandedRun,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    if (expandedRun) queryClient.invalidateQueries({ queryKey: ['payroll-run', expandedRun] });
  };

  const { mutate: generate, isPending: generating } = useMutation({
    mutationFn: () => payrollApi.generateRun({ month: Number(genMonth), year: Number(genYear) }),
    onSuccess: () => { toast.success('Payroll run generated'); invalidate(); setGenerateOpen(false); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: approve } = useMutation({
    mutationFn: (id) => payrollApi.approveRun(id),
    onSuccess: () => { toast.success('Payroll approved'); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: markPaid } = useMutation({
    mutationFn: (id) => payrollApi.markPaid(id),
    onSuccess: () => { toast.success('Payroll marked as paid'); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: deleteRun } = useMutation({
    mutationFn: (id) => payrollApi.deleteRun(id),
    onSuccess: () => { toast.success('Run deleted'); invalidate(); if (expandedRun) setExpandedRun(null); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const runs = runsData ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setGenerateOpen(true)}><Plus className="h-4 w-4" /> Generate Run</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : runs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No payroll runs yet. Generate one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const isExpanded = expandedRun === run._id;
            const detail = isExpanded ? runDetail : null;
            return (
              <Card key={run._id} className="border-border/70">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left"
                      onClick={() => setExpandedRun(isExpanded ? null : run._id)}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div>
                        <CardTitle className="text-base">{MONTH_NAMES[run.month - 1]} {run.year}</CardTitle>
                        <CardDescription className="text-xs">
                          {run.payslipCount ?? 0} staff · Net: {formatCurrency(run.totalNet)}
                        </CardDescription>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={run.status} />
                      {canApprove && run.status === 'draft'    && <Button size="sm" variant="outline" className="h-7 text-blue-700 border-blue-200" onClick={() => approve(run._id)}>Approve</Button>}
                      {canApprove && run.status === 'approved' && <Button size="sm" variant="outline" className="h-7 text-emerald-700 border-emerald-200" onClick={() => markPaid(run._id)}>Mark Paid</Button>}
                      {run.status === 'draft' && <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteRun(run._id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent>
                    {!detail ? (
                      <div className="space-y-1">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              {['Staff', 'Grade', 'Gross', 'NHIF', 'NSSF', 'PAYE', 'Net'].map((h) => (
                                <th key={h} className={`py-2 px-2 font-semibold uppercase tracking-wide ${h === 'Staff' || h === 'Grade' ? 'text-left' : 'text-right'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(detail.payslips ?? []).map((p, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="py-2 px-2">
                                  <p className="font-medium text-slate-900">{p.staffId?.firstName} {p.staffId?.lastName}</p>
                                  <p className="text-slate-400">{p.staffId?.staffId ?? ''}</p>
                                </td>
                                <td className="py-2 px-2 text-slate-600">{p.salaryGrade ?? '—'}</td>
                                <td className="py-2 px-2 text-right font-medium">{formatCurrency(p.grossPay)}</td>
                                <td className="py-2 px-2 text-right text-rose-600">{formatCurrency(p.nhif)}</td>
                                <td className="py-2 px-2 text-right text-rose-600">{formatCurrency(p.nssf)}</td>
                                <td className="py-2 px-2 text-right text-rose-600">{formatCurrency(p.paye)}</td>
                                <td className="py-2 px-2 text-right font-semibold text-emerald-700">{formatCurrency(p.netPay)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
                              <td colSpan={2} className="py-2 px-2">Total</td>
                              <td className="py-2 px-2 text-right">{formatCurrency(detail.totalGross)}</td>
                              <td colSpan={3} />
                              <td className="py-2 px-2 text-right text-emerald-700">{formatCurrency(detail.totalNet)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Generate dialog */}
      <Dialog open={generateOpen} onOpenChange={(v) => !v && setGenerateOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Payroll Run</DialogTitle>
            <DialogDescription>This will compute payslips for all BOM/contract staff based on their assigned salary grade.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gen-month">Month</Label>
              <select id="gen-month" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-year">Year</Label>
              <Input id="gen-year" type="number" min="2020" max="2099" value={genYear} onChange={(e) => setGenYear(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button disabled={generating} onClick={() => generate()}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const { user } = useAuthStore();
  const canApprove = APPROVE_ROLES.includes(user?.role);

  return (
    <div className="space-y-6">
      <PageHeader title="Payroll" description="Manage salary grades and monthly payroll runs">
        <RefreshButton queryKeys={[['payroll-grades'], ['payroll-runs']]} />
      </PageHeader>

      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" aria-hidden />
        <p className="text-sm text-amber-800">TSC teachers are excluded from payroll runs — their salaries are paid directly by the government. Only BOM, contract, and permanent staff are included.</p>
      </div>

      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" aria-hidden /> Payroll Runs
          </TabsTrigger>
          <TabsTrigger value="grades" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" aria-hidden /> Salary Grades
          </TabsTrigger>
        </TabsList>
        <TabsContent value="runs" className="mt-4">
          <RunsTab canApprove={canApprove} />
        </TabsContent>
        <TabsContent value="grades" className="mt-4">
          <GradesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
