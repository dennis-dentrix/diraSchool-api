'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Building2, Users, Ban, CheckCircle2, AlertTriangle, MoreHorizontal, ShieldOff, ShieldCheck } from 'lucide-react';
import { schoolsApi, getErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';

const SUB_COLORS = {
  trial:     'bg-amber-100 text-amber-800',
  active:    'bg-emerald-100 text-emerald-800',
  suspended: 'bg-red-100 text-red-800',
  expired:   'bg-slate-100 text-slate-600',
};

const columns = ({ onToggleActive, onUpdateSub }) => [
  {
    id: 'school',
    header: 'School',
    cell: ({ row }) => {
      const s = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-blue-700" />
          </div>
          <div>
            <p className="font-medium text-sm">{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.email}</p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'subscriptionStatus',
    header: 'Subscription',
    cell: ({ row }) => (
      <span className={cn('text-xs px-2 py-1 rounded-full font-medium capitalize', SUB_COLORS[row.original.subscriptionStatus] ?? 'bg-slate-100 text-slate-600')}>
        {row.original.subscriptionStatus}
      </span>
    ),
  },
  {
    id: 'active',
    header: 'Account',
    cell: ({ row }) => row.original.isActive
      ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Active</span>
      : <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium"><Ban className="h-3.5 w-3.5" /> Disabled</span>,
  },
  { accessorKey: 'county', header: 'County', cell: ({ row }) => <span className="text-sm">{row.original.county ?? '—'}</span> },
  { accessorKey: 'createdAt', header: 'Registered', cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span> },
  {
    id: 'actions',
    cell: ({ row }) => {
      const s = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onUpdateSub(s)}>
              Update Subscription
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {s.isActive ? (
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => onToggleActive(s, false)}
              >
                <ShieldOff className="h-4 w-4 mr-2" /> Disable School
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-emerald-700 focus:text-emerald-700"
                onClick={() => onToggleActive(s, true)}
              >
                <ShieldCheck className="h-4 w-4 mr-2" /> Re-enable School
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

const SUBSCRIPTION_STATUSES = ['trial', 'active', 'suspended', 'expired'];
const PLAN_TIERS = ['trial', 'basic', 'standard', 'premium'];

export default function SuperadminSchoolsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [disableTarget, setDisableTarget] = useState(null); // { school, isActive }
  const [subTarget, setSubTarget] = useState(null);
  const [subForm, setSubForm] = useState({ subscriptionStatus: '', planTier: '', trialExpiry: '' });
  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-schools', page, debouncedSearch, statusFilter, activeFilter],
    queryFn: async () => {
      const res = await schoolsApi.list({
        page, limit: 20,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        active: activeFilter || undefined,
      });
      return res.data;
    },
  });

  const { mutate: toggleActive, isPending: toggling } = useMutation({
    mutationFn: ({ id, isActive }) => schoolsApi.update(id, { isActive }),
    onSuccess: (_, { isActive }) => {
      toast.success(isActive ? 'School re-enabled' : 'School disabled — all staff accounts deactivated');
      queryClient.invalidateQueries({ queryKey: ['superadmin-schools'] });
      setDisableTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: updateSub, isPending: updatingSub } = useMutation({
    mutationFn: ({ id, data }) => schoolsApi.updateSubscription(id, data),
    onSuccess: () => {
      toast.success('Subscription updated');
      queryClient.invalidateQueries({ queryKey: ['superadmin-schools'] });
      setSubTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleToggleActive = (school, isActive) => {
    if (!isActive) {
      setDisableTarget({ school, isActive });
    } else {
      toggleActive({ id: school._id, isActive });
    }
  };

  const handleUpdateSub = (school) => {
    setSubTarget(school);
    setSubForm({
      subscriptionStatus: school.subscriptionStatus,
      planTier: school.planTier ?? 'trial',
      trialExpiry: school.trialExpiry ? new Date(school.trialExpiry).toISOString().split('T')[0] : '',
    });
  };

  const schools = data?.schools ?? data?.data ?? [];
  const pagination = data?.pagination ?? data?.meta;

  return (
    <div className="space-y-5">
      <PageHeader title="Schools" description="Manage all school tenants" />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, email, reg…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Subscription" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subscriptions</SelectItem>
            {SUBSCRIPTION_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={(v) => { setActiveFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Disabled</SelectItem>
          </SelectContent>
        </Select>
        {(search || statusFilter || activeFilter) && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSearch(''); setStatusFilter(''); setActiveFilter(''); setPage(1); }}>
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns({ onToggleActive: handleToggleActive, onUpdateSub: handleUpdateSub })}
        data={schools}
        loading={isLoading}
        pageCount={pagination?.totalPages}
        currentPage={page}
        onPageChange={setPage}
      />

      {/* Disable confirmation dialog */}
      <Dialog open={!!disableTarget} onOpenChange={() => setDisableTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Disable School Account</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Disabling <span className="font-semibold text-foreground">{disableTarget?.school?.name}</span> will immediately:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            <li>Block all staff from logging in</li>
            <li>Deactivate all staff user accounts</li>
            <li>Preserve all school data intact</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={toggling}
              onClick={() => toggleActive({ id: disableTarget.school._id, isActive: false })}>
              Disable School
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription update dialog */}
      <Dialog open={!!subTarget} onOpenChange={() => setSubTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Update Subscription — {subTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={subForm.subscriptionStatus} onValueChange={(v) => setSubForm((p) => ({ ...p, subscriptionStatus: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Plan Tier</Label>
              <Select value={subForm.planTier} onValueChange={(v) => setSubForm((p) => ({ ...p, planTier: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_TIERS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {subForm.subscriptionStatus === 'trial' && (
              <div className="space-y-1.5">
                <Label>Trial Expiry</Label>
                <Input type="date" value={subForm.trialExpiry} onChange={(e) => setSubForm((p) => ({ ...p, trialExpiry: e.target.value }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubTarget(null)}>Cancel</Button>
            <Button disabled={updatingSub}
              onClick={() => updateSub({
                id: subTarget._id,
                data: {
                  subscriptionStatus: subForm.subscriptionStatus,
                  planTier: subForm.planTier,
                  trialExpiry: subForm.subscriptionStatus === 'trial' && subForm.trialExpiry ? subForm.trialExpiry : undefined,
                },
              })}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
