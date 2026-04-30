'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Bell, LogOut, Settings, Loader2, CheckCheck, UserPen } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query';
import { authApi, notificationsApi, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';

export function Header({ onMenuClick, title, schoolName, termLabel, schoolDayStatus }) {
  const router = useRouter();
  const { user, logout, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '' });
  const isFetching = useIsFetching();
  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await notificationsApi.unreadCount();
      return res.data?.count ?? res.data?.data?.count ?? 0;
    },
    staleTime: 10_000,
    refetchInterval: 20_000,
    enabled: !!user && user.role !== 'superadmin',
  });
  const { data: notifData } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: async () => {
      const res = await notificationsApi.list({ page: 1, limit: 8 });
      return res.data?.notifications ?? res.data?.data ?? [];
    },
    staleTime: 10_000,
    refetchInterval: 20_000,
    enabled: !!user && user.role !== 'superadmin',
  });
  const unreadCount = unreadData ?? 0;
  const notifications = Array.isArray(notifData) ? notifData : [];

  const { mutate: doLogout } = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      logout();
      queryClient.clear();
      router.push('/login');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const { mutate: markAllRead, isPending: markingAllRead } = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });
  const { mutate: markRead } = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: (data) => authApi.updateMe(data),
    onSuccess: (res) => {
      const updatedUser = res.data?.user ?? res.data?.data?.user;
      if (updatedUser && setUser) setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('Profile updated');
      setProfileOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <header className="h-14 border-b border-border/60 bg-background/80 backdrop-blur-sm flex items-center gap-4 px-4 shrink-0 sticky top-0 z-40">
      {/* Mobile menu toggle */}
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Page title + global fetch indicator */}
      <div className="flex-1 hidden sm:flex items-center gap-2.5 min-w-0">
        <h1 className="text-base font-semibold tracking-tight shrink-0">{title}</h1>
        {schoolName && (
          <span className="text-xs text-muted-foreground truncate border-l pl-2">
            {schoolName}
          </span>
        )}
        {termLabel && (
          <span className="text-xs text-muted-foreground truncate border-l pl-2">
            {termLabel}
          </span>
        )}
        {schoolDayStatus && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 truncate">
            {schoolDayStatus}
          </span>
        )}
        {isFetching > 0 && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 sm:hidden min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold tracking-tight truncate">{title}</h1>
          {isFetching > 0 && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
        </div>
        {(termLabel || schoolDayStatus) && (
          <p className="text-[11px] text-muted-foreground truncate">
            {termLabel}
            {termLabel && schoolDayStatus ? ' · ' : ''}
            {schoolDayStatus}
          </p>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] leading-4 text-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80 max-h-[420px] overflow-y-auto" align="end">
            <DropdownMenuLabel className="font-normal flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Notifications</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={markingAllRead || unreadCount === 0}
                onClick={() => markAllRead()}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet</div>
            ) : notifications.map((n) => (
              <DropdownMenuItem
                key={n._id}
                className="items-start py-2.5 cursor-pointer"
                onClick={() => {
                  if (!n.readAt) markRead(n._id);
                  if (n.link) router.push(n.link);
                }}
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.message && <p className="text-xs text-muted-foreground whitespace-normal">{n.message}</p>}
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                    {!n.readAt ? ' · Unread' : ''}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-600 text-white text-xs">
                  {user ? getInitials(user.firstName, user.lastName) : '??'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                {schoolName && <p className="text-xs text-muted-foreground truncate">{schoolName}</p>}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              setProfileForm({ firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', phone: user?.phone ?? '' });
              setProfileOpen(true);
            }}>
              <UserPen className="mr-2 h-4 w-4" />
              Edit Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => doLogout()} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, firstName: e.target.value }))}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, lastName: e.target.value }))}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="0712 345 678"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>Cancel</Button>
            <Button
              disabled={savingProfile}
              onClick={() => saveProfile({
                firstName: profileForm.firstName || undefined,
                lastName: profileForm.lastName || undefined,
                phone: profileForm.phone || undefined,
              })}
            >
              {savingProfile ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
