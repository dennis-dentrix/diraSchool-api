'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parentApi } from '@/lib/api';
import { formatDate, formatCurrency, capitalize } from '@/lib/utils';
import { GraduationCap, CreditCard, ClipboardList, FileText, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

function ChildSelector({ children, selected, onSelect }) {
  return (
    <div className="flex gap-2 flex-wrap mb-6">
      {children.map((child) => (
        <button
          key={child._id}
          onClick={() => onSelect(child._id)}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            selected === child._id
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
          }`}
        >
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
            selected === child._id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {child.firstName?.[0]}{child.lastName?.[0]}
          </div>
          {child.firstName} {child.lastName}
        </button>
      ))}
    </div>
  );
}

function StatPill({ label, value, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    yellow: 'bg-yellow-50 text-yellow-700',
  };
  return (
    <div className={`rounded-xl px-5 py-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function FeesTab({ studentId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['parent-fees', studentId],
    queryFn: async () => { const res = await parentApi.fees(studentId); return res.data.data; },
    enabled: !!studentId,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data) return <p className="text-sm text-muted-foreground py-8 text-center">No fee data available.</p>;

  const balance = data.balance ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatPill label="Total Billed" value={formatCurrency(data.totalBilled ?? 0)} color="blue" />
        <StatPill label="Paid" value={formatCurrency(data.totalPaid ?? 0)} color="green" />
        <StatPill label="Balance" value={formatCurrency(balance)} color={balance > 0 ? 'red' : 'green'} />
      </div>

      {(data.payments ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Payment History</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {data.payments.map((p) => (
                <div key={p._id} className="flex justify-between items-center py-3">
                  <div>
                    <p className="text-sm font-medium">{p.description ?? 'Payment'}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.paidAt ?? p.createdAt)} · {p.method}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AttendanceTab({ studentId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['parent-attendance', studentId],
    queryFn: async () => { const res = await parentApi.attendance(studentId); return res.data.data; },
    enabled: !!studentId,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data) return <p className="text-sm text-muted-foreground py-8 text-center">No attendance data available.</p>;

  const summary = data.summary ?? {};
  const records = data.records ?? [];
  const total = Object.values(summary).reduce((a, b) => a + b, 0) || 1;
  const rate = Math.round(((summary.present ?? 0) / total) * 100);

  const statusColors = {
    present: 'bg-green-100 text-green-700',
    absent: 'bg-red-100 text-red-700',
    late: 'bg-yellow-100 text-yellow-700',
    excused: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill label="Present" value={summary.present ?? 0} color="green" />
        <StatPill label="Absent" value={summary.absent ?? 0} color="red" />
        <StatPill label="Late" value={summary.late ?? 0} color="yellow" />
        <StatPill label="Attendance Rate" value={`${rate}%`} color={rate >= 80 ? 'green' : 'red'} />
      </div>

      {records.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Records</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {records.slice(0, 20).map((r) => (
                <div key={r._id} className="flex justify-between items-center py-2.5">
                  <p className="text-sm">{formatDate(r.date)}</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${statusColors[r.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResultsTab({ studentId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['parent-results', studentId],
    queryFn: async () => { const res = await parentApi.results(studentId); return res.data.data; },
    enabled: !!studentId,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  const results = data ?? [];
  if (!results.length) return <p className="text-sm text-muted-foreground py-8 text-center">No results available yet.</p>;

  return (
    <div className="space-y-3">
      {results.map((r) => (
        <Card key={r._id}>
          <CardContent className="py-3 px-4 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">{typeof r.subjectId === 'object' ? r.subjectId.name : '—'}</p>
              <p className="text-xs text-muted-foreground">{typeof r.examId === 'object' ? r.examId.name : '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-blue-600">{r.score ?? r.grade ?? '—'}</p>
              {r.totalMarks && <p className="text-xs text-muted-foreground">/ {r.totalMarks}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ReportCardsTab({ studentId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['parent-reportcards', studentId],
    queryFn: async () => { const res = await parentApi.reportCards(studentId); return res.data.data; },
    enabled: !!studentId,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  const cards = data ?? [];
  if (!cards.length) return <p className="text-sm text-muted-foreground py-8 text-center">No report cards published yet.</p>;

  return (
    <div className="space-y-3">
      {cards.map((rc) => (
        <Card key={rc._id}>
          <CardContent className="py-4 px-4 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">{rc.term} · {rc.academicYear}</p>
              <p className="text-xs text-muted-foreground">Published {formatDate(rc.publishedAt ?? rc.createdAt)}</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">Published</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ParentPortalPage() {
  const [selectedChild, setSelectedChild] = useState(null);

  const { data: childrenData, isLoading } = useQuery({
    queryKey: ['parent-children'],
    queryFn: async () => {
      const res = await parentApi.children();
      return res.data.data;
    },
    onSuccess: (data) => {
      if (data?.length && !selectedChild) setSelectedChild(data[0]._id);
    },
  });

  const children = childrenData ?? [];
  const child = children.find((c) => c._id === selectedChild);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!children.length) {
    return (
      <div className="text-center py-16">
        <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-40" />
        <h2 className="text-lg font-semibold mb-1">No children linked</h2>
        <p className="text-sm text-muted-foreground">Contact your school to link your children to this account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Child selector */}
      {children.length > 1 && (
        <ChildSelector children={children} selected={selectedChild} onSelect={setSelectedChild} />
      )}

      {/* Active child info banner */}
      {child && (
        <div className="flex items-center gap-3 p-4 bg-white rounded-xl border mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm shrink-0">
            {child.firstName?.[0]}{child.lastName?.[0]}
          </div>
          <div>
            <p className="font-semibold">{child.firstName} {child.lastName}</p>
            <p className="text-xs text-muted-foreground">
              {typeof child.classId === 'object' ? `${child.classId.name}${child.classId.stream ? ` ${child.classId.stream}` : ''}` : 'No class assigned'}
              {' · '}Adm: {child.admissionNumber}
            </p>
          </div>
          <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium capitalize ${child.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {capitalize(child.status ?? '')}
          </span>
        </div>
      )}

      {/* Tabs */}
      {selectedChild && (
        <Tabs defaultValue="fees">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="fees" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" />Fees</TabsTrigger>
            <TabsTrigger value="attendance" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" />Attendance</TabsTrigger>
            <TabsTrigger value="results" className="gap-1.5"><GraduationCap className="h-3.5 w-3.5" />Results</TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Reports</TabsTrigger>
          </TabsList>
          <TabsContent value="fees" className="mt-4"><FeesTab studentId={selectedChild} /></TabsContent>
          <TabsContent value="attendance" className="mt-4"><AttendanceTab studentId={selectedChild} /></TabsContent>
          <TabsContent value="results" className="mt-4"><ResultsTab studentId={selectedChild} /></TabsContent>
          <TabsContent value="reports" className="mt-4"><ReportCardsTab studentId={selectedChild} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
