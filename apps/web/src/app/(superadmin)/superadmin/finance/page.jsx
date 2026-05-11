'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  Landmark,
  Plus,
  Receipt,
  Trash2,
  Scale,
} from 'lucide-react';
import { adminApi, getErrorMessage } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const fmt = (n) => `KES ${Math.round(Number(n) || 0).toLocaleString('en-KE')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const EXPENSE_CATEGORIES = [
  ['hosting', 'Hosting'],
  ['sms', 'SMS'],
  ['email', 'Email'],
  ['storage', 'Storage'],
  ['software', 'Software'],
  ['payroll', 'Payroll'],
  ['marketing', 'Marketing'],
  ['tax', 'Tax'],
  ['office', 'Office'],
  ['professional_services', 'Professional services'],
  ['other', 'Other'],
];

const TAX_TYPES = [
  ['vat', 'VAT'],
  ['corporation_tax', 'Corporation tax'],
  ['installment_tax', 'Installment tax'],
  ['paye', 'PAYE'],
  ['withholding_tax', 'Withholding tax'],
  ['withholding_vat', 'Withholding VAT'],
  ['affordable_housing_levy', 'Affordable Housing Levy'],
  ['nssf', 'NSSF'],
  ['shif', 'SHIF'],
  ['fringe_benefit_tax', 'Fringe benefit tax'],
  ['advance_tax', 'Advance tax'],
  ['excise_duty', 'Excise duty'],
  ['digital_service_tax', 'Digital service tax'],
  ['other', 'Other tax'],
];

const DEFAULT_MARGIN_TAX_TYPES = new Set([
  'affordable_housing_levy',
  'nssf',
  'fringe_benefit_tax',
  'advance_tax',
  'excise_duty',
  'digital_service_tax',
  'other',
]);

const taxLabel = (value) => TAX_TYPES.find(([key]) => key === value)?.[1] ?? value?.replace(/_/g, ' ') ?? 'Tax';

const statusColor = {
  completed: 'bg-ok/8 text-ok border-ok/30',
  processing: 'bg-primary/8 text-primary border-primary/30',
  pending: 'bg-warn/8 text-warn border-warn/30',
  failed: 'bg-bad/8 text-bad border-bad/30',
  paid: 'bg-ok/8 text-ok border-ok/30',
  overdue: 'bg-bad/8 text-bad border-bad/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

function Metric({ label, value, icon: Icon, tone }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <Icon className={cn('h-4 w-4', tone)} />
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ExpenseForm() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    category: 'software',
    vendor: '',
    amount: '',
    vatAmount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    status: 'paid',
    paymentMethod: '',
    reference: '',
    receiptUrl: '',
    notes: '',
  });

  const set = (key) => (valueOrEvent) => {
    const value = valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const create = useMutation({
    mutationFn: (payload) => adminApi.createFinanceExpense(payload),
    onSuccess: () => {
      toast.success('Expense recorded');
      setForm((f) => ({ ...f, title: '', vendor: '', amount: '', vatAmount: '', paymentMethod: '', reference: '', receiptUrl: '', notes: '' }));
      qc.invalidateQueries({ queryKey: ['admin-finance'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          Record Expense
        </CardTitle>
        <CardDescription>Capture business costs with invoice or receipt references.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              ...form,
              amount: Number(form.amount),
              vatAmount: form.vatAmount === '' ? 0 : Number(form.vatAmount),
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={set('title')} placeholder="e.g. May hosting invoice" required />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Input value={form.vendor} onChange={set('vendor')} placeholder="e.g. DigitalOcean" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={set('category')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" min="0" value={form.amount} onChange={set('amount')} required />
            </div>
            <div className="space-y-1.5">
              <Label>VAT amount</Label>
              <Input type="number" min="0" value={form.vatAmount} onChange={set('vatAmount')} placeholder="0 if not claimable" />
            </div>
            <div className="space-y-1.5">
              <Label>Payment date</Label>
              <Input type="date" value={form.paymentDate} onChange={set('paymentDate')} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={set('status')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Input value={form.paymentMethod} onChange={set('paymentMethod')} placeholder="Card, M-Pesa, bank" />
            </div>
            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input value={form.reference} onChange={set('reference')} placeholder="Invoice or transaction ref" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Receipt URL</Label>
            <Input value={form.receiptUrl} onChange={set('receiptUrl')} placeholder="Link to receipt or invoice file" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Internal context, renewal period, or approval details." />
          </div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Save expense'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TaxForm() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    taxType: 'paye',
    treatment: 'payable',
    amountDue: '',
    amountPaid: '',
    periodStart: '',
    periodEnd: '',
    dueDate: new Date().toISOString().slice(0, 10),
    status: 'pending',
    reference: '',
    attachmentUrl: '',
    notes: '',
    affectsMargin: false,
  });

  const set = (key) => (valueOrEvent) => {
    const value = valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const setTaxType = (value) => {
    setForm((f) => ({
      ...f,
      taxType: value,
      affectsMargin: f.treatment === 'credit' ? false : DEFAULT_MARGIN_TAX_TYPES.has(value),
    }));
  };

  const setTreatment = (value) => {
    setForm((f) => ({
      ...f,
      treatment: value,
      affectsMargin: value === 'credit' ? false : f.affectsMargin,
    }));
  };

  const create = useMutation({
    mutationFn: (payload) => adminApi.createFinanceTax(payload),
    onSuccess: () => {
      toast.success('Tax record saved');
      setForm((f) => ({
        ...f,
        title: '',
        amountDue: '',
        amountPaid: '',
        periodStart: '',
        periodEnd: '',
        reference: '',
        attachmentUrl: '',
        notes: '',
      }));
      qc.invalidateQueries({ queryKey: ['admin-finance'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Record Tax
        </CardTitle>
        <CardDescription>Capture statutory liabilities, payments, and credits that are not calculated from invoices.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              ...form,
              amountDue: Number(form.amountDue),
              amountPaid: form.amountPaid === '' ? 0 : Number(form.amountPaid),
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={set('title')} placeholder="e.g. May PAYE return" required />
            </div>
            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input value={form.reference} onChange={set('reference')} placeholder="Payment slip or certificate ref" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Tax type</Label>
              <Select value={form.taxType} onValueChange={setTaxType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAX_TYPES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Treatment</Label>
              <Select value={form.treatment} onValueChange={setTreatment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="payable">Payable</SelectItem>
                  <SelectItem value="credit">Credit / prepayment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount due</Label>
              <Input type="number" min="0" value={form.amountDue} onChange={set('amountDue')} required />
            </div>
            <div className="space-y-1.5">
              <Label>Amount paid</Label>
              <Input type="number" min="0" value={form.amountPaid} onChange={set('amountPaid')} placeholder="0" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Period start</Label>
              <Input type="date" value={form.periodStart} onChange={set('periodStart')} />
            </div>
            <div className="space-y-1.5">
              <Label>Period end</Label>
              <Input type="date" value={form.periodEnd} onChange={set('periodEnd')} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={form.dueDate} onChange={set('dueDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={set('status')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={form.affectsMargin}
              disabled={form.treatment === 'credit'}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, affectsMargin: Boolean(checked) }))}
            />
            Include this tax in the final margin calculation
          </label>
          <div className="space-y-1.5">
            <Label>Attachment URL</Label>
            <Input value={form.attachmentUrl} onChange={set('attachmentUrl')} placeholder="Link to payment slip, return, or certificate" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Internal tax context or accountant notes." />
          </div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Save tax record'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SuperadminFinancePage() {
  const qc = useQueryClient();

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['admin-finance', 'summary'],
    queryFn: async () => {
      const res = await adminApi.financeSummary();
      return res.data?.data ?? res.data;
    },
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['admin-finance', 'payments'],
    queryFn: async () => {
      const res = await adminApi.financePayments({ limit: 25 });
      return res.data?.payments ?? res.data?.data ?? [];
    },
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['admin-finance', 'expenses'],
    queryFn: async () => {
      const res = await adminApi.financeExpenses({ limit: 25 });
      return res.data?.expenses ?? res.data?.data ?? [];
    },
  });

  const { data: taxesData, isLoading: taxesLoading } = useQuery({
    queryKey: ['admin-finance', 'taxes'],
    queryFn: async () => {
      const res = await adminApi.financeTaxes({ limit: 25 });
      return res.data?.taxRecords ?? res.data?.data?.taxRecords ?? [];
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id) => adminApi.deleteFinanceExpense(id),
    onSuccess: () => {
      toast.success('Expense deleted');
      qc.invalidateQueries({ queryKey: ['admin-finance'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteTax = useMutation({
    mutationFn: (id) => adminApi.deleteFinanceTax(id),
    onSuccess: () => {
      toast.success('Tax record deleted');
      qc.invalidateQueries({ queryKey: ['admin-finance'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const summary = summaryData?.summary ?? {};
  const taxes = summaryData?.taxes ?? {};
  const margins = summaryData?.margins ?? {};
  const taxRows = Array.isArray(taxes.taxRows) ? taxes.taxRows : [];
  const payments = Array.isArray(paymentsData) ? paymentsData : [];
  const expenses = Array.isArray(expensesData) ? expensesData : [];
  const taxRecords = Array.isArray(taxesData) ? taxesData : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Management"
        description="Track DiraSchool revenue, paid school invoices, operating expenses, and tax liabilities."
        overline="Superadmin"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <Metric label="Collected revenue" value={fmt(summary.revenue)} icon={ArrowUpRight} tone="text-ok" />
            <Metric label="Expenses paid" value={fmt(summary.expenses)} icon={ArrowDownLeft} tone="text-bad" />
            <Metric label="Taxes due" value={fmt(taxes.totalTaxDue)} icon={Scale} tone={taxes.totalTaxDue > 0 ? 'text-warn' : 'text-ok'} />
            <Metric label="Final margin" value={fmt(margins.finalMarginAfterTaxes)} icon={Landmark} tone={margins.finalMarginAfterTaxes >= 0 ? 'text-ok' : 'text-bad'} />
          </>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Taxes Due</CardTitle>
            <CardDescription>VAT is calculated from invoices; other statutory taxes come from recorded tax entries.</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-40 rounded-lg" />
            ) : (
              <div className="space-y-2 text-sm">
                {taxRows.map((row) => (
                  <div key={`${row.taxType}-${row.treatment}-${row.source}`} className="border-b last:border-0 py-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium">{row.label}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {row.source}
                          {row.affectsMargin ? ' · affects margin' : ' · pass-through / credit'}
                        </p>
                      </div>
                      <span className="font-mono font-medium">{fmt(row.amountDue)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                      <span>Paid / credited</span>
                      <span className="font-mono">{fmt(row.amountPaid)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                      <span>Outstanding</span>
                      <span className="font-mono">{fmt(row.outstanding)}</span>
                    </div>
                  </div>
                ))}
                <div className="pt-2 space-y-1 border-t">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold">Total taxes due</span>
                    <span className="font-mono font-semibold">{fmt(taxes.totalTaxDue)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                    <span>Pass-through taxes recorded</span>
                    <span className="font-mono">{fmt(taxes.passThroughTaxesDue)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">{taxes.dueDateNote}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Final Margin</CardTitle>
            <CardDescription>Margin after VAT, estimated corporation tax, and recorded margin-impacting taxes.</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-40 rounded-lg" />
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4 border-b py-2">
                  <span className="text-muted-foreground">Operating margin ex VAT</span>
                  <span className="font-mono font-medium">{fmt(margins.operatingMarginExVat)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b py-2">
                  <span className="text-muted-foreground">Operating margin rate</span>
                  <span className="font-mono font-medium">{Number(margins.operatingMarginRate ?? 0).toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b py-2">
                  <span className="text-muted-foreground">Cash net before VAT settlement</span>
                  <span className="font-mono font-medium">{fmt(summary.net)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b py-2">
                  <span className="text-muted-foreground">Less VAT due</span>
                  <span className="font-mono font-medium">{fmt(taxes.vatDue)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b py-2">
                  <span className="text-muted-foreground">Less corporation tax estimate</span>
                  <span className="font-mono font-medium">{fmt(taxes.corporationTaxEstimate)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b py-2">
                  <span className="text-muted-foreground">Less recorded margin taxes</span>
                  <span className="font-mono font-medium">{fmt(taxes.marginRecordedTaxesDue)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 pt-3 text-base font-semibold">
                  <span>Final margin after taxes</span>
                  <span className={cn('font-mono', margins.finalMarginAfterTaxes >= 0 ? 'text-ok' : 'text-bad')}>
                    {fmt(margins.finalMarginAfterTaxes)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Margin rate: {Number(margins.finalMarginAfterTaxesRate ?? 0).toFixed(2)}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ExpenseForm />
        <TaxForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            School Payments and Invoice Copies
          </CardTitle>
          <CardDescription>Completed subscription payments retain an immutable invoice snapshot.</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}
            </div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No school subscription payments yet.</p>
          ) : (
            <div className="divide-y">
              {payments.map((payment) => {
                const invoice = payment.invoiceSnapshot;
                return (
                  <div key={payment._id} className="py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{payment.schoolId?.name ?? invoice?.school?.name ?? 'School'}</p>
                        <Badge variant="outline" className={cn('text-[10px] capitalize', statusColor[payment.status])}>
                          {payment.status}
                        </Badge>
                        {payment.pricingSource && payment.pricingSource !== 'standard' && (
                          <Badge variant="outline" className="text-[10px] border-ok/30 text-ok bg-ok/5">
                            {payment.pricingSource} pricing
                          </Badge>
                        )}
                        {payment.paymentType === 'sms_credits' && (
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5">
                            SMS credits
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {invoice?.invoiceNumber ?? `INV-${String(payment._id).slice(-8).toUpperCase()}`} · {fmtDate(payment.paidAt ?? payment.createdAt)}
                        {payment.paymentType === 'sms_credits'
                          ? ` · ${payment.metadata?.credits ?? invoice?.metadata?.credits ?? '—'} SMS credits`
                          : ` · ${payment.studentCount} students`}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{payment.merchantReference}</p>
                    </div>
                    <p className="font-mono text-sm font-semibold shrink-0">{fmt(payment.amount)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense Records</CardTitle>
          <CardDescription>Business expenses recorded by the DiraSchool team.</CardDescription>
        </CardHeader>
        <CardContent>
          {expensesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}
            </div>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No expenses recorded yet.</p>
          ) : (
            <div className="divide-y">
              {expenses.map((expense) => (
                <div key={expense._id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{expense.title}</p>
                      <Badge variant="outline" className={cn('text-[10px] capitalize', statusColor[expense.status])}>
                        {expense.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {expense.category.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {expense.vendor || 'No vendor'} · {fmtDate(expense.paymentDate)}
                      {expense.reference ? ` · ${expense.reference}` : ''}
                    </p>
                    {expense.vatAmount > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">VAT: {fmt(expense.vatAmount)}</p>
                    )}
                    {expense.receiptUrl && (
                      <a href={expense.receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline underline-offset-2">
                        Receipt or invoice
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-mono text-sm font-semibold">{fmt(expense.amount)}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteExpense.mutate(expense._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tax Records</CardTitle>
            <CardDescription>Recorded liabilities, prepayments, and tax credits.</CardDescription>
          </CardHeader>
          <CardContent>
            {taxesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}
              </div>
            ) : taxRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No tax records saved yet.</p>
            ) : (
              <div className="divide-y">
                {taxRecords.map((tax) => (
                  <div key={tax._id} className="py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{tax.title}</p>
                        <Badge variant="outline" className={cn('text-[10px] capitalize', statusColor[tax.status])}>
                          {tax.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {taxLabel(tax.taxType)}
                        </Badge>
                        {tax.treatment === 'credit' && (
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5">
                            credit
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Due {fmtDate(tax.dueDate)}
                        {tax.periodStart || tax.periodEnd ? ` · Period ${fmtDate(tax.periodStart)} - ${fmtDate(tax.periodEnd)}` : ''}
                        {tax.reference ? ` · ${tax.reference}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Paid: {fmt(tax.amountPaid)} · {tax.affectsMargin ? 'Affects margin' : 'Pass-through / credit'}
                      </p>
                      {tax.attachmentUrl && (
                        <a href={tax.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline underline-offset-2">
                          Return or certificate
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-mono text-sm font-semibold">{fmt(tax.amountDue)}</p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteTax.mutate(tax._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
