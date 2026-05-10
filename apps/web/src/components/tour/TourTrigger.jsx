'use client';

import { useState, useEffect } from 'react';
import { Rocket, X, PlayCircle } from 'lucide-react';
import { useTourContext } from './TourProvider';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

const DISMISS_KEY = 'diraschool-tour-banner-dismissed';

function isBannerDismissed() {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}
function dismissBanner() {
  try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
}

// ── Getting Started banner ─────────────────────────────────────────────────────
export function TourBanner() {
  const { tourCompleted, launchTour } = useTourContext();
  const [dismissed, setDismissed] = useState(true); // start hidden, check after mount

  useEffect(() => {
    setDismissed(isBannerDismissed());
  }, []);

  if (tourCompleted || dismissed) return null;

  function handleDismiss() {
    dismissBanner();
    setDismissed(true);
  }

  return (
    <div className="relative flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
        <Rocket className="h-[18px] w-[18px]" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight text-foreground">
          Getting started with Diraschool
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          A quick 2-minute tour — we'll show you exactly what matters for your role.
        </p>
      </div>

      <Button
        size="sm"
        className="h-8 w-full shrink-0 gap-1.5 px-3.5 text-xs font-semibold sm:w-auto"
        onClick={launchTour}
      >
        <PlayCircle className="h-3.5 w-3.5" />
        Start tour
      </Button>

      <button
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:static sm:shrink-0"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── "Take a Tour" menu item for the header profile dropdown ───────────────────
export function TakeTourMenuItem() {
  const { launchTour } = useTourContext();

  return (
    <DropdownMenuItem onClick={launchTour} data-tour="help-menu">
      <Rocket className="mr-2 h-4 w-4" />
      Take a tour
    </DropdownMenuItem>
  );
}
