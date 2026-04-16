'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { formatDate, getRoleBadgeColor, capitalize } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLES } from '@/lib/constants';

const ROLE_OPTIONS = [
  'superadmin', 'school_admin', 'director', 'headteacher',
  'deputy_headteacher', 'secretary', 'accountant', 'teacher', 'parent',
];

const columns = [
  {
    accessorKey: 'firstName',
    header: 'Name',
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-sm">{row.original.firstName} {row.original.lastName}</p>
        <p className="text-xs text-muted-foreground">{row.original.email}</p>
      </div>
    ),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => (
      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${getRoleBadgeColor(row.original.role)}`}>
        {row.original.role?.replace(/_/g, ' ')}
      </span>
    ),
  },
  {
    accessorKey: 'schoolId',
    header: 'School',
    cell: ({ row }) => (
      <span className="text-sm">
        {typeof row.original.schoolId === 'object'
          ? row.original.schoolId?.name
          : row.original.schoolId ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${row.original.status === 'active' ? 'bg-green-100 text-green-800' : row.original.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
        {row.original.status}
      </span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Joined',
    cell: ({ row }) => <span className="text-sm">{formatDate(row.original.createdAt)}</span>,
  },
];

export default function SuperadminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-users', page, search, roleFilter],
    queryFn: async () => {
      const res = await usersApi.list({
        page, limit: 20,
        search: search || undefined,
        role: roleFilter || undefined,
      });
      return res.data;
    },
  });

  return (
    <div>
      <PageHeader
        title="All Users"
        description={`${data?.pagination?.total ?? '…'} users across the platform`}
      />

      <div className="flex gap-3 mb-4 flex-wrap">
        <Input
          placeholder="Search users…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-56"
        />
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All roles</SelectItem>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        loading={isLoading}
        pageCount={data?.pagination?.pages}
        currentPage={page}
        onPageChange={setPage}
      />
    </div>
  );
}
