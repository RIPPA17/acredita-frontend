import { useCallback, useState } from 'react';

const STORAGE_KEY = 'sidebar_collapsed';

export function useSidebarPreference(defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return defaultCollapsed;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? defaultCollapsed : stored === 'true';
  });

  const setSidebarCollapsed = useCallback((next: boolean) => {
    setCollapsed(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed(current => {
      const next = !current;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  }, []);

  return { sidebarCollapsed: collapsed, setSidebarCollapsed, toggleSidebar };
}
