'use client';

import { useState } from 'react';
import { Rocket, X, PlayCircle } from 'lucide-react';
import { useTourContext } from './TourProvider';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

// ── Getting Started banner shown on the dashboard until tour is completed ─────
export function TourBanner() {
  const { tourCompleted, launchTour } = useTourContext();
  const [dismissed, setDismissed] = useState(false);

  if (tourCompleted || dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 text-sm">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white shrink-0">
        <Rocket className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-blue-900 leading-tight">Getting started with Diraschool</p>
        <p className="text-blue-700/80 text-xs mt-0.5 hidden sm:block">
          Take a 2-minute tour to learn the key features for your role.
        </p>
      </div>
      <Button
        size="sm"
        className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white h-8 px-3 text-xs font-semibold"
        onClick={launchTour}
      >
        <PlayCircle className="h-3.5 w-3.5 mr-1" />
        Start tour
      </Button>
      <button
        className="shrink-0 text-blue-400 hover:text-blue-600 p-1 rounded transition-colors"
        onClick={() => setDismissed(true)}
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
      <PlayCircle className="mr-2 h-4 w-4" />
      Take a Tour
    </DropdownMenuItem>
  );
}
