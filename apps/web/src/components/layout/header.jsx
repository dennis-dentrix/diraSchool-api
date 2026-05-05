'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Bell, LogOut, Settings, Loader2, CheckCheck, UserPen, LogIn, MapPin, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query';
import { authApi, notificationsApi, checkInsApi, getErrorMessage } from '@/lib/api';
import { TakeTourMenuItem } from '@/components/tour/TourTrigger';
import { useSocketNotifications } from '@/hooks/use-socket-notifications';
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

const CHECK_IN_ROLES = [
  'teacher', 'department_head', 'secretary', 'accountant',
  'headteacher', 'deputy_headteacher', 'director',
];
const SOFT_ENFORCE_ROLES = ['headteacher', 'deputy_headteacher', 'director'];

export function Header({ onMenuClick, title, schoolName, termLabel, schoolDayStatus }) {
  const router = useRouter();
  const { user, logout, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '' });
  const isFetching = useIsFetching();
  const {
    notifications,
    unreadCount,
    markRead:    markReadSocket,
    markAllRead: markAllReadSocket,
  } = useSocketNotifications({ enabled: !!user && user.role !== 'superadmin' });

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
    mutationFn: markAllReadSocket,
  });
  const { mutate: markRead } = useMutation({
    mutationFn: markReadSocket,
  });

  // ── Check-in (header quick button) ────────────────────────────────────────
  const canCheckIn = !!user && CHECK_IN_ROLES.includes(user.role);
  const [ciState, setCiState]       = useState('idle'); // idle | locating | submitting
  const [pendingCiPayload, setPendingCiPayload] = useState(null);

  const { data: todayCheckIns } = useQuery({
    queryKey: ['checkins-today'],
    queryFn: async () => {
      const res = await checkInsApi.today();
      return res.data?.checkIns ?? res.data?.data ?? [];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: canCheckIn,
  });

  const morningIn  = todayCheckIns?.find((c) => c.check_in_type === 'morning_in');
  const eveningOut = todayCheckIns?.find((c) => c.check_in_type === 'evening_out');
  const checkInType = morningIn && !eveningOut ? 'evening_out' : 'morning_in';
  const allDoneToday = !!(morningIn && eveningOut);

  const { mutate: submitCi } = useMutation({
    mutationFn: (data) => checkInsApi.checkIn(data),
    onSuccess: (res) => {
      const data = res.data?.checkIn ?? res.data?.data?.checkIn;
      const isLate = data?.status === 'late';
      const label  = checkInType === 'morning_in' ? 'Checked in' : 'Checked out';
      toast.success(`${label}${isLate ? ' (late)' : ''} · ${new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`);
      setCiState('idle');
      queryClient.invalidateQueries({ queryKey: ['checkins-today'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
    },
    onError: (err) => {
      const errData = err?.response?.data;
      if (errData?.code === 'OFF_SITE_REASON_REQUIRED' && SOFT_ENFORCE_ROLES.includes(user?.role)) {
        toast.warning('You appear to be off-site. Open the dashboard to submit an off-site reason.');
        setCiState('idle');
        return;
      }
      toast.error(errData?.message ?? getErrorMessage(err));
      setCiState('idle');
    },
  });

  const handleHeaderCheckIn = useCallback(() => {
    if (ciState !== 'idle' || allDoneToday) return;
    setCiState('locating');
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      setCiState('idle');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude, accuracy } }) => {
        const payload = { latitude, longitude, accuracy, check_in_type: checkInType, client_timestamp: new Date().toISOString() };
        setPendingCiPayload(payload);
        setCiState('submitting');
        submitCi(payload);
      },
      (err) => {
        const msg = err.code === 1 ? 'Location access denied. Enable location to check in.' : 'Could not get your location. Please try again.';
        toast.error(msg);
        setCiState('idle');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }, [ciState, allDoneToday, checkInType, submitCi]);

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
        {/* Check-in quick button */}
        {canCheckIn && (
          allDoneToday ? (
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Done for today
            </span>
          ) : (
            <Button
              size="sm"
              variant={morningIn ? 'outline' : 'default'}
              className={`gap-1.5 h-8 px-3 text-xs font-medium ${morningIn ? 'border-slate-300' : 'bg-cyan-700 hover:bg-cyan-800 text-white'}`}
              disabled={ciState !== 'idle'}
              onClick={handleHeaderCheckIn}
              data-tour="checkin-button"
            >
              {ciState === 'locating' || ciState === 'submitting' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : morningIn ? (
                <><LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Check Out</span></>
              ) : (
                <><LogIn className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Check In</span></>
              )}
            </Button>
          )
        )}

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
            <TakeTourMenuItem />
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
