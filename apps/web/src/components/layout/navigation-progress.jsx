'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Thin top progress bar that shows on every route change.
 * No external dependency — pure CSS animation.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const prevPathname = useRef(pathname);
  const timerRef = useRef(null);

  useEffect(() => {
    // Pathname changed → start progress
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;

      // Clear any existing timer
      clearTimeout(timerRef.current);

      // Start the bar
      setWidth(0);
      setVisible(true);

      // Animate to 90% quickly, then finish to 100% when done
      requestAnimationFrame(() => {
        setWidth(70);
        timerRef.current = setTimeout(() => setWidth(90), 400);
      });

      // Complete and hide after a short delay
      const done = setTimeout(() => {
        setWidth(100);
        setTimeout(() => setVisible(false), 300);
      }, 500);

      return () => {
        clearTimeout(done);
        clearTimeout(timerRef.current);
      };
    }
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '3px',
        width: `${width}%`,
        background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
        transition: width === 100 ? 'width 0.2s ease, opacity 0.3s ease' : 'width 0.4s ease',
        zIndex: 9999,
        borderRadius: '0 2px 2px 0',
      }}
    />
  );
}
