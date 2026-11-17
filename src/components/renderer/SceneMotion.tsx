'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Progressive enhancement: content is readable before hydration and if motion is unavailable. */
export function SceneMotion({ children, enabled, sceneKey }: { children: ReactNode; enabled: boolean; sceneKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || !('IntersectionObserver' in window) || !('animate' in el)) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;
    let disposed = false;
    let animation: { cancel: () => void } | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      void import('motion/mini').then(({ animate }) => {
        if (disposed || preference.matches || !el.isConnected) return;
        animation = animate(el, { opacity: [0.65, 1], transform: ['translateY(12px)', 'translateY(0px)'] }, { duration: 0.48, ease: [0.22, 1, 0.36, 1] });
      }).catch(() => { /* Native content remains visible without the optional animation. */ });
    }, { threshold: 0, rootMargin: '0px 0px 20px 0px' });
    observer.observe(el);
    const preferenceChanged = () => { if (preference.matches) animation?.cancel(); };
    preference.addEventListener?.('change', preferenceChanged);
    return () => { disposed = true; observer.disconnect(); animation?.cancel(); preference.removeEventListener?.('change', preferenceChanged); };
  }, [enabled, sceneKey]);
  return <div ref={ref} data-motion-scene={sceneKey}>{children}</div>;
}
