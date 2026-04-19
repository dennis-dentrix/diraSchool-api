'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, MoreHorizontal, Mail, KeyRound, PauseCircle, PlayCircle, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usersApi, getErrorMessage } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/constants';
import { getRoleBadgeColor, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDebounce } from '@/hooks/use-debounce';

const STAFF_ROLES = [
  'school_admin', 'director', 'headteacher', 'deputy_headteacher',
  'secretary', 'accountant', 'teacher',
];

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Enter valid email'),
  role: z.string().min(1, 'Required'),
  phone: z.string().optional(),
  tscNumber: z.string().optional(),
});

const columns = ({ onResendInvite, onResetPassword, onToggleActive, onPauseRequest }) => [
  {
    id: 'name',
    header: 'Staff Member',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-blue-700">
            {row.original.firstName?.[0]}{row.original.lastName?.[0]}
          </span>
        </div>
        <div>
          <p className="font-medium text-sm">{row.original.firstName} {row.original.lastName}</p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getRoleBadgeColor(row.original.role)}`}>
        {ROLE_LABELS[row.original.role] ?? row.original.role}
      </span>
    ),
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }) => <span className="text-sm">{row.original.phone ?? '—'}</span>,
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const u = row.original;
      if (!u.isActive)
        return <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">Paused</span>;
      if (u.invitePending)
        return <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-100 text-yellow-800">Invite Pending</span>;
      return <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-800">Active</span>;
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Joined',
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const u = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {u.invitePending && u.isActive && (
              <DropdownMenuItem onClick={() => onResendInvite(u._id)}>
                <Mail className="h-4 w-4 mr-2" /> Resend Invite
              </DropdownMenuItem>
            )}
            {!u.invitePending && (
              <DropdownMenuItem onClick={() => onResetPassword(u._id)}>
                <KeyRound className="h-4 w-4 mr-2" /> Send Password Reset
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {u.isActive ? (
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => onPauseRequest(u)}
              >
                <PauseCircle className="h-4 w-4 mr-2" /> Pause Account
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-green-700 focus:text-green-700"
                onClick={() => onToggleActive(u._id, true)}
              >
                <PlayCircle className="h-4 w-4 mr-2" /> Reactivate Account
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pauseTarget, setPauseTarget] = useState(null);
  const [pauseReason, setPauseReason] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const statusParams = {
    active:   { isActive: 'true',  invitePending: 'false' },
    invite:   { isActive: 'true',  invitePending: 'true'  },
    paused:   { isActive: 'false'                         },
  }[statusFilter] ?? {};

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['users', page, debouncedSearch, roleFilter, statusFilter],
    queryFn: async () => {
      const res = await usersApi.list({
        page, limit: 20,
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        ...statusParams,
      });
      // normalizer puts the array in res.data.data AND res.data.users
      return res.data;
    },
  });

  // Handle both normalized shape { users: [...], meta/pagination: {...} } and raw array
  const staffRows = rawData?.users ?? (Array.isArray(rawData?.data) ? rawData.data : Array.isArray(rawData) ? rawData : []);
  const pagination = rawData?.pagination ?? rawData?.meta;

  const active   = staffRows.filter((u) => u.isActive && !u.invitePending);
  const pending  = staffRows.filter((u) => u.isActive && u.invitePending);
  const paused   = staffRows.filter((u) => !u.isActive);

  const { mutate: createUser, isPending } = useMutation({
    mutationFn: (data) => usersApi.create(data),
    onSuccess: () => {
      toast.success('Staff member invited via email');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: resendInvite } = useMutation({
    mutationFn: (id) => usersApi.resendInvite(id),
    onSuccess: () => toast.success('Invite resent'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: resetPassword } = useMutation({
    mutationFn: (id) => usersApi.resetPassword(id),
    onSuccess: () => toast.success('Password reset email sent'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: toggleActive } = useMutation({
    mutationFn: ({ id, isActive, reason }) => usersApi.toggleActive(id, isActive, reason),
    onSuccess: (_, { isActive }) => {
      toast.success(isActive ? 'Account reactivated' : 'Account paused');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleConfirmPause = () => {
    if (!pauseTarget) return;
    toggleActive({ id: pauseTarget._id, isActive: false, reason: pauseReason || undefined });
    setPauseTarget(null);
    setPauseReason('');
  };

  const actionHandlers = {
    onResendInvite: (id) => resendInvite(id),
    onResetPassword: (id) => resetPassword(id),
    onToggleActive: (id, isActive) => toggleActive({ id, isActive }),
    onPauseRequest: (user) => { setPauseTarget(user); setPauseReason(''); },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Staff ${staffRows.length ? `(${pagination?.total ?? staffRows.length})` : ''}`}
        description="Manage teaching and non-teaching staff"
      >
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Invite Staff
        </Button>
      </PageHeader>

      {/* ── Summary cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4 px-5">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <UserCheck className="h-4 w-4 text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{active.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4 px-5">
            <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-yellow-700" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{pending.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Invite Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4 px-5">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <UserX className="h-4 w-4 text-red-700" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{paused.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Paused</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All roles</SelectItem>
            {STAFF_ROLES.map((r) => (
              <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invite">Invite Pending</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns(actionHandlers)}
        data={staffRows}
        loading={isLoading}
        pageCount={pagination?.totalPages}
        currentPage={page}
        onPageChange={setPage}
      />

      {/* ── Pause confirmation dialog ─────────────────────────────────────────── */}
      <Dialog open={!!pauseTarget} onOpenChange={(v) => { if (!v) { setPauseTarget(null); setPauseReason(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <DialogTitle>Pause Account</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                  {pauseTarget?.firstName} {pauseTarget?.lastName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              This staff member will immediately lose access to the system and will not be able to log in until their account is reactivated.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="pause-reason">Reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="pause-reason"
                placeholder="e.g. On leave, disciplinary action…"
                rows={3}
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => { setPauseTarget(null); setPauseReason(''); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmPause}>
              <PauseCircle className="h-4 w-4 mr-1.5" /> Pause Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invite dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invite Staff Member</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(createUser)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input {...register('firstName')} placeholder="Jane" />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input {...register('lastName')} placeholder="Wanjiru" />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input {...register('email')} type="email" placeholder="staff@school.ac.ke" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select onValueChange={(v) => setValue('role', v)}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone (optional)</Label>
                <Input {...register('phone')} placeholder="0712 345 678" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>TSC Number (optional)</Label>
              <Input {...register('tscNumber')} placeholder="TSC/12345" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>Send Invite</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
