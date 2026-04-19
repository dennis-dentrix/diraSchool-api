'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { feesApi, classesApi, getErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ACADEMIC_YEARS, TERMS, CURRENT_YEAR } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const CATEGORIES = [
  'School Fees',
  'One-Time Payment',
  'Boarding / Hostel',
  'Transport',
  'Stationery / Books',
  'Uniform',
  'Activity / Sports',
  'Other',
];

const CONFIRM_INIT = { open: false, id: null };

function groupByCategory(items = []) {
  return items.reduce((acc, item) => {
    const cat = item.category || 'School Fees';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
}

// ── Print a single fee structure ──────────────────────────────────────────────
function printStructure(structure) {
  const className = typeof structure.classId === 'object'
    ? `${structure.classId.name}${structure.classId.stream ? ` ${structure.classId.stream}` : ''}`
    : '—';
  const grouped = groupByCategory(structure.items);

  const rows = Object.entries(grouped).map(([cat, items]) => `
    <tr><td colspan="2" class="cat">${cat}</td></tr>
    ${items.map((item) => `
      <tr>
        <td>${item.name}</td>
        <td class="amt">${formatCurrency(item.amount)}</td>
      </tr>
    `).join('')}
  `).join('');

  const win = window.open('', '', 'width=680,height=900');
  win.document.write(`<!DOCTYPE html>
<html><head><title>Fee Structure — ${className}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; margin: 32px; color: #111; }
  h2  { text-align: center; margin: 0 0 4px; font-size: 18px; }
  .sub { text-align: center; color: #555; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th  { text-align: left; border-bottom: 2px solid #333; padding: 6px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #555; }
  td  { padding: 5px 4px; border-bottom: 1px solid #eee; }
  .cat { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #444; padding-top: 14px; border-bottom: none; }
  .amt { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  .total { border-top: 2px solid #333; font-weight: 700; font-size: 14px; }
  .notes { margin-top: 20px; font-size: 11px; color: #555; background: #f8f8f8; padding: 10px 12px; border-radius: 4px; }
  @media print { body { margin: 16px; } }
</style></head><body>
  <h2>${className}</h2>
  <p class="sub">Fee Structure · ${structure.term} · ${structure.academicYear}</p>
  <table>
    <thead><tr><th>Description / Particulars</th><th style="text-align:right">Amount (KES)</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="total">
        <td>Total Per Term</td>
        <td class="amt">${formatCurrency(structure.totalAmount)}</td>
      </tr>
    </tbody>
  </table>
  ${structure.notes ? `<div class="notes"><strong>NB:</strong> ${structure.notes}</div>` : ''}
</body></html>`);
  win.document.close();
  win.print();
  win.close();
}

// ── Single structure card ─────────────────────────────────────────────────────
function StructureCard({ structure, onDelete }) {
  const grouped = groupByCategory(structure.items);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs font-medium">{structure.term}</Badge>
              <Badge variant="secondary" className="text-xs">{structure.academicYear}</Badge>
            </div>
            <p className="text-xl font-bold text-blue-600 mt-2 tabular-nums">
              {formatCurrency(structure.totalAmount)}
            </p>
            <p className="text-xs text-muted-foreground">Total per term</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => printStructure(structure)}
              title="Print fee structure"
            >
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {cat}
            </p>
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-0.5">
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium tabular-nums">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        ))}
        <Separator />
        <div className="flex items-center justify-between text-sm font-bold">
          <span>Total</span>
          <span className="text-blue-600 tabular-nums">{formatCurrency(structure.totalAmount)}</span>
        </div>
        {structure.notes && (
          <p className="text-xs text-muted-foreground bg-slate-50 rounded-md px-3 py-2 italic border">
            NB: {structure.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Class group with collapsible structures ───────────────────────────────────
function ClassGroup({ className, structures, onDelete }) {
  const [collapsed, setCollapsed] = useState(false);
  const Icon = collapsed ? ChevronRight : ChevronDown;

  return (
    <div className="space-y-3">
      <button
        className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-blue-600 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <Icon className="h-4 w-4 text-muted-foreground" />
        {className}
        <span className="text-xs font-normal text-muted-foreground">({structures.length} structure{structures.length !== 1 ? 's' : ''})</span>
      </button>

      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pl-6">
          {structures.map((s) => (
            <StructureCard
              key={s._id}
              structure={s}
              onDelete={() => onDelete(s._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FeeStructuresPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterYear,  setFilterYear]  = useState(String(CURRENT_YEAR));
  const [filterTerm,  setFilterTerm]  = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(CONFIRM_INIT);

  const { register, handleSubmit, reset, setValue, control, watch } = useForm({
    defaultValues: {
      classId: '',
      academicYear: String(CURRENT_YEAR),
      term: 'Term 1',
      notes: '',
      items: [
        { category: 'School Fees', name: 'Tuition Fee', amount: '' },
        { category: 'School Fees', name: 'Admission Fee (One Time)', amount: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const total = items?.reduce((s, i) => s + (Number(i.amount) || 0), 0) ?? 0;

  const { data, isLoading } = useQuery({
    queryKey: ['fee-structures', filterYear, filterTerm, filterClass],
    queryFn: async () => {
      const params = { limit: 200 };
      if (filterYear)  params.academicYear = filterYear;
      if (filterTerm)  params.term         = filterTerm;
      if (filterClass) params.classId      = filterClass;
      const res = await feesApi.listStructures(params);
      return res.data;
    },
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => { const res = await classesApi.list({ limit: 100 }); return res.data; },
  });

  const { mutate: createStructure, isPending } = useMutation({
    mutationFn: (data) => feesApi.createStructure({
      ...data,
      items: data.items
        .filter((i) => i.name && i.amount)
        .map((i) => ({ category: i.category || 'School Fees', name: i.name, amount: Number(i.amount) })),
      notes: data.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Fee structure created');
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: deleteStructure } = useMutation({
    mutationFn: (id) => feesApi.deleteStructure(id),
    onSuccess: () => { toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['fee-structures'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const structures = data?.data ?? [];
  const classes = classesData?.data ?? classesData?.classes ?? [];

  // Group by class for display
  const grouped = useMemo(() => {
    const map = new Map();
    for (const s of structures) {
      const cls = s.classId;
      const key = typeof cls === 'object' ? cls._id : String(cls);
      const label = typeof cls === 'object'
        ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}`
        : '—';
      if (!map.has(key)) map.set(key, { label, structures: [] });
      map.get(key).structures.push(s);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [structures]);

  const hasFilters = filterYear || filterTerm || filterClass;

  return (
    <div className="space-y-5">
      <PageHeader title="Fee Structures" description="Configure term fees per class">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Structure
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterYear} onValueChange={(v) => setFilterYear(v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-9 w-28 text-xs"><SelectValue placeholder="All years" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All years</SelectItem>
            {ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterTerm} onValueChange={(v) => setFilterTerm(v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-9 w-28 text-xs"><SelectValue placeholder="All terms" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All terms</SelectItem>
            {TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterClass} onValueChange={(v) => setFilterClass(v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-9 w-40 text-xs"><SelectValue placeholder="All classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c._id} value={c._id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setFilterYear(''); setFilterTerm(''); setFilterClass(''); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
      ) : structures.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium">No fee structures found</p>
          <p className="text-sm mt-1">Create a structure for each class and term.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ label, structures: classStructures }) => (
            <ClassGroup
              key={label}
              className={label}
              structures={classStructures}
              onDelete={(id) => setConfirmDialog({ open: true, id })}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Fee Structure</DialogTitle>
            <p className="text-sm text-muted-foreground">Add all fee items for this class and term. Empty rows are ignored.</p>
          </DialogHeader>

          <form onSubmit={handleSubmit(createStructure)} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Class <span className="text-destructive">*</span></Label>
                <Select onValueChange={(v) => setValue('classId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}{c.stream ? ` ${c.stream}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Academic Year</Label>
                <Select defaultValue={String(CURRENT_YEAR)} onValueChange={(v) => setValue('academicYear', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Term</Label>
                <Select defaultValue="Term 1" onValueChange={(v) => setValue('term', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Fee items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fee Items</Label>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => append({ category: 'School Fees', name: '', amount: '' })}
                >
                  <Plus className="h-3 w-3" /> Add Row
                </Button>
              </div>

              <div className="grid grid-cols-[1fr_1.5fr_6rem_2rem] gap-2 px-1">
                <p className="text-xs font-medium text-muted-foreground">Category</p>
                <p className="text-xs font-medium text-muted-foreground">Description</p>
                <p className="text-xs font-medium text-muted-foreground text-right">Amount (KES)</p>
                <span />
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {fields.map((field, i) => (
                  <div key={field.id} className="grid grid-cols-[1fr_1.5fr_6rem_2rem] gap-2 items-center">
                    <Select
                      defaultValue={field.category || 'School Fees'}
                      onValueChange={(v) => setValue(`items.${i}.category`, v)}
                    >
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Input
                      {...register(`items.${i}.name`)}
                      placeholder="e.g. Tuition Fee"
                      className="h-9 text-sm"
                    />

                    <Input
                      {...register(`items.${i}.amount`)}
                      placeholder="0"
                      type="number"
                      min="0"
                      className="h-9 text-sm text-right"
                    />

                    {fields.length > 1 ? (
                      <Button type="button" variant="ghost" size="icon"
                        className="h-9 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : <span />}
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2 border-t">
                <div className="text-sm font-semibold flex gap-4">
                  <span className="text-muted-foreground">Total Per Term:</span>
                  <span className="text-blue-600 tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Notes / NB <span className="text-muted-foreground text-xs">(optional — appears on invoices)</span></Label>
              <Textarea
                {...register('notes')}
                placeholder="e.g. Tuition fee inclusive of meals. Transport fee varies by distance."
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Structure'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(CONFIRM_INIT)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete fee structure?</AlertDialogTitle>
            <AlertDialogDescription>
              This structure will be permanently removed. Student invoices that reference it will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteStructure(confirmDialog.id); setConfirmDialog(CONFIRM_INIT); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
