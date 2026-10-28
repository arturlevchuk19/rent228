import { useEffect, useState } from 'react';

const pages = new Set([
  'calendar', 'dashboard', 'equipment', 'events', 'contacts', 'payments',
  'personnel-report', 'staff', 'templates', 'logistics', 'users', 'settings',
]);

const readPage = () => {
  const page = new URL(window.location.href).searchParams.get('page');
  return page && pages.has(page) ? page : 'calendar';
};

export function usePageNavigation() {
  const [currentPage, setCurrentPage] = useState(readPage);

  useEffect(() => {
    // Event navigation may restore the URL when the user declines to discard edits.
    // Read it after every popstate handler has had a chance to run.
    let active = true;
    const sync = () => queueMicrotask(() => { if (active) setCurrentPage(readPage()); });
    window.addEventListener('popstate', sync);
    return () => { active = false; window.removeEventListener('popstate', sync); };
  }, []);

  const navigate = (page: string) => {
    if (!pages.has(page)) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('page') !== page) {
      url.searchParams.set('page', page);
      window.history.pushState({ ...window.history.state, eventPage: false }, '', url);
    }
    setCurrentPage(page);
  };

  return { currentPage, navigate };
}
