'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, MoreHorizontal, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usersApi, getErrorMessage } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/constants';
import { getRoleBadgeColor } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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

const columns = (onResendInvite) => [
  {
    id: 'name',
    header: 'Staff Member',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.firstName} {row.original.lastName}</p>
        <p className="text-xs text-muted-foreground">{row.original.email}</p>
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
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      if (!row.original.isActive) {
        return <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-800">Paused</span>;
      }
      if (row.original.invitePending) {
        return <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-100 text-yellow-800">Invite Pending</span>;
      }
      return <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-800">Invite Accepted</span>;
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Joined',
    cell: ({ row }) => <span className="text-sm">{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {row.original.invitePending && row.original.isActive && (
            <DropdownMenuItem onClick={() => onResendInvite(row.original._id)}>
              <Mail className="h-4 w-4 mr-2" /> Resend invite
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['staff', page, debouncedSearch, roleFilter],
    queryFn: async () => {
      const res = await usersApi.list({
        page, limit: 20,
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
      });
      return res.data.data ?? res.data;
    },
  });

  const staffRows = Array.isArray(data?.users)
    ? data.users
    : Array.isArray(data?.data)
      ? data.data
      : [];
  const pagination = data?.meta ?? data?.pagination;

  const pendingInvites = staffRows.filter((u) => u.isActive && u.invitePending);
  const acceptedInvites = staffRows.filter((u) => u.isActive && !u.invitePending);
  const pausedAccounts = staffRows.filter((u) => !u.isActive);

  const { mutate: createUser, isPending } = useMutation({
    mutationFn: (data) => usersApi.create(data),
    onSuccess: () => {
      toast.success('Staff member invited via email');
      queryClient.invalidateQueries({ queryKey: ['staff'] });
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

  return (
    <div>
      <PageHeader title="Staff" description="Manage teaching and non-teaching staff">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Invite Staff
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search staff…" className="pl-9" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All roles</SelectItem>
            {STAFF_ROLES.map((r) => (
              <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pending Invites ({pendingInvites.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {pendingInvites.length ? pendingInvites.slice(0, 5).map((u) => (
              <p key={u._id} className="text-sm">{u.firstName} {u.lastName}</p>
            )) : <p className="text-sm text-muted-foreground">No pending invites</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Accepted Invites ({acceptedInvites.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {acceptedInvites.length ? acceptedInvites.slice(0, 5).map((u) => (
              <p key={u._id} className="text-sm">{u.firstName} {u.lastName}</p>
            )) : <p className="text-sm text-muted-foreground">No accepted invites</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Paused Accounts ({pausedAccounts.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {pausedAccounts.length ? pausedAccounts.slice(0, 5).map((u) => (
              <p key={u._id} className="text-sm">{u.firstName} {u.lastName}</p>
            )) : <p className="text-sm text-muted-foreground">No paused accounts</p>}
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns(resendInvite)}
        data={staffRows}
        loading={isLoading}
        pageCount={pagination?.pages}
        currentPage={page}
        onPageChange={setPage}
      />

      <Dialog open={open} onOpenChange={setOpen}>
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
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
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
