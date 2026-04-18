'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';
import { libraryApi, getErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { useDebounce } from '@/hooks/use-debounce';

const bookColumns = (onLoan) => [
  { accessorKey: 'title', header: 'Title', cell: ({ row }) => <span className="font-medium">{row.original.title}</span> },
  { accessorKey: 'author', header: 'Author', cell: ({ row }) => <span className="text-sm">{row.original.author ?? '—'}</span> },
  { accessorKey: 'isbn', header: 'ISBN', cell: ({ row }) => <span className="text-xs font-mono">{row.original.isbn ?? '—'}</span> },
  { accessorKey: 'availableCopies', header: 'Available', cell: ({ row }) => <span className={`font-semibold ${row.original.availableCopies === 0 ? 'text-destructive' : 'text-green-600'}`}>{row.original.availableCopies}/{row.original.totalCopies}</span> },
  { id: 'actions', cell: ({ row }) => row.original.availableCopies > 0 && <Button size="sm" variant="outline" onClick={() => onLoan(row.original)}>Issue</Button> },
];

const loanColumns = (onReturn) => [
  { accessorKey: 'bookId', header: 'Book', cell: ({ row }) => <span className="font-medium">{typeof row.original.bookId === 'object' ? row.original.bookId.title : '—'}</span> },
  { accessorKey: 'borrowerName', header: 'Borrower', cell: ({ row }) => <span className="text-sm">{row.original.borrowerName}</span> },
  { accessorKey: 'dueDate', header: 'Due Date', cell: ({ row }) => <span className="text-sm">{formatDate(row.original.dueDate)}</span> },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${row.original.status === 'active' ? 'bg-blue-100 text-blue-800' : row.original.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
        {row.original.status}
      </span>
    ),
  },
  { id: 'actions', cell: ({ row }) => row.original.status === 'active' && <Button size="sm" variant="outline" onClick={() => onReturn(row.original._id)}>Return</Button> },
];

export default function LibraryPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [loanTarget, setLoanTarget] = useState(null);
  const [loanForm, setLoanForm] = useState({ borrowerType: 'student', borrowerName: '', dueDate: '' });
  const [bookSearch, setBookSearch] = useState('');
  const [loanStatusFilter, setLoanStatusFilter] = useState('');
  const [loanSearch, setLoanSearch] = useState('');
  const debouncedBookSearch = useDebounce(bookSearch, 400);
  const debouncedLoanSearch = useDebounce(loanSearch, 400);
  const { register, handleSubmit, reset } = useForm();

  const { data: books, isLoading: booksLoading } = useQuery({
    queryKey: ['books', debouncedBookSearch],
    queryFn: async () => {
      const res = await libraryApi.listBooks({ limit: 50, search: debouncedBookSearch || undefined });
      return res.data;
    },
  });
  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ['loans', loanStatusFilter, debouncedLoanSearch],
    queryFn: async () => {
      const res = await libraryApi.listLoans({
        limit: 50,
        status: loanStatusFilter || undefined,
        search: debouncedLoanSearch || undefined,
      });
      return res.data;
    },
  });

  const { mutate: addBook, isPending } = useMutation({
    mutationFn: (data) => libraryApi.createBook(data),
    onSuccess: () => { toast.success('Book added'); queryClient.invalidateQueries({ queryKey: ['books'] }); setAddOpen(false); reset(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: issueLoan } = useMutation({
    mutationFn: (data) => libraryApi.issueLoan(data),
    onSuccess: () => { toast.success('Book issued'); queryClient.invalidateQueries({ queryKey: ['books', 'loans'] }); setLoanOpen(false); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: returnBook } = useMutation({
    mutationFn: (id) => libraryApi.returnBook(id),
    onSuccess: () => { toast.success('Book returned'); queryClient.invalidateQueries({ queryKey: ['books', 'loans'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader title="Library" description="Manage books and loans">
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Book</Button>
      </PageHeader>

      <Tabs defaultValue="books">
        <TabsList className="mb-4">
          <TabsTrigger value="books">Books ({books?.pagination?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="loans">Active Loans ({loans?.data?.filter((l) => l.status === 'active').length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="books">
          <div className="relative mb-3 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by title or author…" value={bookSearch} onChange={(e) => setBookSearch(e.target.value)} className="pl-8 h-9" />
          </div>
          <DataTable columns={bookColumns((book) => { setLoanTarget(book); setLoanOpen(true); })} data={books?.data} loading={booksLoading} />
        </TabsContent>

        <TabsContent value="loans">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search borrower name…" value={loanSearch} onChange={(e) => setLoanSearch(e.target.value)} className="pl-8 h-9" />
            </div>
            <Select value={loanStatusFilter} onValueChange={(v) => setLoanStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DataTable columns={loanColumns((id) => { if (confirm('Mark as returned?')) returnBook(id); })} data={loans?.data} loading={loansLoading} />
        </TabsContent>
      </Tabs>

      {/* Add book */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Book</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(addBook)} className="space-y-4">
            <div className="space-y-1.5"><Label>Title</Label><Input {...register('title', { required: true })} placeholder="Animal Farm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Author</Label><Input {...register('author')} placeholder="George Orwell" /></div>
              <div className="space-y-1.5"><Label>ISBN</Label><Input {...register('isbn')} placeholder="978-..." /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Total Copies</Label><Input {...register('totalCopies')} type="number" defaultValue={1} /></div>
              <div className="space-y-1.5"><Label>Category</Label><Input {...register('category')} placeholder="Fiction" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>Add Book</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Issue loan */}
      <Dialog open={loanOpen} onOpenChange={setLoanOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Issue — {loanTarget?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Borrower Name</Label>
              <Input value={loanForm.borrowerName} onChange={(e) => setLoanForm((p) => ({ ...p, borrowerName: e.target.value }))} placeholder="Student / Staff name" />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <input type="date" value={loanForm.dueDate} onChange={(e) => setLoanForm((p) => ({ ...p, dueDate: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoanOpen(false)}>Cancel</Button>
            <Button onClick={() => issueLoan({ bookId: loanTarget?._id, ...loanForm })} disabled={!loanForm.borrowerName || !loanForm.dueDate}>Issue Book</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
