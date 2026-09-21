import * as React from 'react';

const STORAGE_KEY = 'sidebar_collapsed';

export function usePersistentSidebar(collapseBelowWidth?: number) {
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'true';
    return collapseBelowWidth ? window.innerWidth < collapseBelowWidth : false;
  });

  const toggle = React.useCallback(() => {
    setCollapsed(current => {
      const next = !current;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
