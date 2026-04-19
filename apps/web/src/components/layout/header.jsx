'use client';

import { useRouter } from 'next/navigation';
import { Menu, Bell, LogOut, Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient, useIsFetching } from '@tanstack/react-query';
import { authApi, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';

export function Header({ onMenuClick, title, schoolName }) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const isFetching = useIsFetching();

  const { mutate: doLogout } = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      logout();
      queryClient.clear();
      router.push('/login');
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
        {isFetching > 0 && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 md:hidden" />

      {/* Right side */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Bell className="h-5 w-5" />
        </Button>

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
    </header>
  );
}
