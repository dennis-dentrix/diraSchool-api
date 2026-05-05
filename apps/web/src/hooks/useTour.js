'use client';

import { useCallback, useRef, useEffect } from 'react';
import { getTourStepsForRole } from '@/lib/tour/tourConfig';
import { api } from '@/lib/api';

const LS_KEY = 'diraschool-tour-completed';

// Persist completion to localStorage immediately so the tour won't
// flash again on the current session even before the API call resolves.
function markLocallyDone() {
  try { localStorage.setItem(LS_KEY, '1'); } catch {}
}

export function isTourLocallyDone() {
  try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
}

export function clearLocalTourFlag() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

async function markTourComplete(skipped = false) {
  try {
    await api.post('/onboarding/complete', { completed: true, skipped });
  } catch {}
}

export function useTour(role) {
  const tourRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (tourRef.current) {
        try { tourRef.current.cancel(); } catch {}
        tourRef.current = null;
      }
    };
  }, []);

  const startTour = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const steps = getTourStepsForRole(role);
    if (!steps?.length) return;

    // Lazy-import Shepherd to avoid SSR issues
    const [{ default: Shepherd }] = await Promise.all([
      import('shepherd.js'),
      import('@/components/tour/tourTheme.css'),
      import('shepherd.js/dist/css/shepherd.css'),
    ]);

    // Cancel any running tour first
    if (tourRef.current) {
      try { tourRef.current.cancel(); } catch {}
    }

    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: { enabled: true },
        scrollTo: { behavior: 'smooth', block: 'center' },
        modalOverlayOpeningRadius: 6,
        modalOverlayOpeningPadding: 4,
        popperOptions: {
          modifiers: [{ name: 'offset', options: { offset: [0, 12] } }],
        },
      },
    });

    // Inject step counter + progress bar on every step show
    tour.on('show', () => {
      requestAnimationFrame(() => {
        const currentStep = tour.getCurrentStep();
        if (!currentStep) return;
        const idx   = steps.findIndex((s) => s.id === currentStep.id);
        const total = steps.length;
        const stepNum = idx + 1;

        // Step counter pill in header
        const header = document.querySelector('.shepherd-header');
        if (header && !header.querySelector('.tour-step-counter')) {
          const pill = document.createElement('span');
          pill.className = 'tour-step-counter';
          pill.textContent = `${stepNum} of ${total}`;
          header.appendChild(pill);
        } else if (header) {
          const pill = header.querySelector('.tour-step-counter');
          if (pill) pill.textContent = `${stepNum} of ${total}`;
        }

        // Progress bar
        const existingBar = document.querySelector('.tour-progress-bar-wrapper');
        if (existingBar) existingBar.remove();

        const textEl = document.querySelector('.shepherd-text');
        if (textEl) {
          const wrapper = document.createElement('div');
          wrapper.className = 'tour-progress-bar-wrapper';
          wrapper.innerHTML = `
            <div class="tour-progress-bar">
              <div class="tour-progress-bar-fill" style="width:${(stepNum / total) * 100}%"></div>
            </div>
          `;
          textEl.insertAdjacentElement('afterend', wrapper);
        }
      });
    });

    // Handle skip
    tour.on('cancel', () => {
      markLocallyDone();
      markTourComplete(true);
      tourRef.current = null;
    });

    // Handle complete
    tour.on('complete', () => {
      markLocallyDone();
      markTourComplete(false);
      tourRef.current = null;
    });

    // Add steps, gracefully skipping those with missing elements
    steps.forEach((step) => {
      tour.addStep({
        id: step.id,
        title: step.title,
        text: step.text,
        attachTo: step.attachTo,
        buttons: step.buttons,
        when: {
          show() {
            // If target element no longer in DOM, advance automatically
            if (step.attachTo?.element) {
              const el = document.querySelector(step.attachTo.element);
              if (!el) {
                setTimeout(() => { try { tour.next(); } catch {} }, 50);
              }
            }
          },
        },
      });
    });

    tourRef.current = tour;
    tour.start();
  }, [role]);

  return { startTour };
}
