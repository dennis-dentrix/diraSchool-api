'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Search,
  Phone,
  Mail,
  Users,
  Clock,
  LogIn,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

const urgencyConfig = (daysLeft) => {
  if (daysLeft <= 3)  return { label: 'Expiring', cls: 'bg-red-100 text-red-800',    icon: AlertTriangle };
  if (daysLeft <= 7)  return { label: 'Soon',     cls: 'bg-orange-100 text-orange-800', icon: Clock };
  if (daysLeft <= 15) return { label: 'Midpoint', cls: 'bg-yellow-100 text-yellow-800', icon: Clock };
  return               { label: 'Active',   cls: 'bg-green-100 text-green-800',   icon: CheckCircle2 };
};

const fmtRelative = (date) => {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return formatDate(date);
};

export default function TrialActivityPage() {
  const [search, setSearch] = useState('');

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['trial-activity'],
    queryFn: () => adminApi.trialActivity().then((r) => r.data.data),
  });

  const filtered = schools.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.county?.toLowerCase().includes(q) ||
      s.admin?.name?.toLowerCase().includes(q)
    );
  });

  const expiringSoon = schools.filter((s) => s.daysLeft <= 7).length;
  const noStudents   = schools.filter((s) => s.studentCount === 0).length;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Trial Schools"
        description={`${schools.length} active trial school${schools.length !== 1 ? 's' : ''}${expiringSoon ? ` · ${expiringSoon} expiring within 7 days` : ''}`}
      />

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm shadow-sm">
          <span className="font-semibold text-gray-800">{schools.length}</span>
          <span className="text-gray-500">total trial</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-red-50 px-4 py-2 text-sm shadow-sm">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="font-semibold text-red-700">{expiringSoon}</span>
          <span className="text-red-600">expiring ≤ 7 days</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-orange-50 px-4 py-2 text-sm shadow-sm">
          <Users className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-orange-700">{noStudents}</span>
          <span className="text-orange-600">no students yet</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search school, county, admin..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">School</th>
              <th className="px-4 py-3 font-medium text-gray-600">Admin</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-center">Students</th>
              <th className="px-4 py-3 font-medium text-gray-600">Trial</th>
              <th className="px-4 py-3 font-medium text-gray-600">Last Login</th>
              <th className="px-4 py-3 font-medium text-gray-600">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : filtered.length === 0
              ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                      {search ? 'No schools match your search.' : 'No trial schools.'}
                    </td>
                  </tr>
                )
              : filtered.map((school) => {
                  const { label, cls, icon: Icon } = urgencyConfig(school.daysLeft);
                  const hasNoStudents = school.studentCount === 0;

                  return (
                    <tr key={school._id} className="hover:bg-gray-50 transition-colors">
                      {/* School */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{school.name}</div>
                        <div className="text-xs text-gray-500">{school.county || '—'}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Day {school.daysActive} of 30
                        </div>
                      </td>

                      {/* Admin */}
                      <td className="px-4 py-3">
                        <div className="text-gray-800">{school.admin?.name || '—'}</div>
                        <div className="text-xs text-gray-500">{school.admin?.email || '—'}</div>
                      </td>

                      {/* Students */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            hasNoStudents
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          <Users className="h-3 w-3" />
                          {school.studentCount}
                        </span>
                      </td>

                      {/* Trial expiry */}
                      <td className="px-4 py-3">
                        <Badge className={`${cls} border-0 gap-1`}>
                          <Icon className="h-3 w-3" />
                          {school.daysLeft}d left
                        </Badge>
                        <div className="text-xs text-gray-400 mt-1">
                          Expires {formatDate(school.trialExpiry)}
                        </div>
                      </td>

                      {/* Last login */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <LogIn className="h-3.5 w-3.5 text-gray-400" />
                          {fmtRelative(school.admin?.lastLoginAt)}
                        </div>
                      </td>

                      {/* Contact actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {(school.admin?.phone || school.phone) && (
                            <a
                              href={`tel:${school.admin?.phone || school.phone}`}
                              title="Call admin"
                              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                            >
                              <Phone className="h-4 w-4" />
                            </a>
                          )}
                          {school.admin?.email && (
                            <a
                              href={`mailto:${school.admin.email}?subject=Your Diraschool trial — ${school.name}`}
                              title="Email admin"
                              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                            >
                              <Mail className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
